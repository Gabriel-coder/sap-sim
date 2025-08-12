pipeline {
  agent any
  options { timestamps() }
  environment {
    APP_HOST   = "10.70.1.170"              // IP PRIVADO da APP
    APP_PUBLIC = "http://107.20.96.191"     // URL pública (Nginx)
    APP_DIR    = "/opt/sap-sim"
    CRED_ID    = "app-ssh"
  }
  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Build & Test') {
      steps {
        sh '''
          set -euo pipefail
          [ -f package-lock.json ] && npm ci || npm install
          npm test
        '''
      }
    }

    stage('Package') {
      steps { sh 'tar czf app.tgz --exclude=node_modules --exclude=.git .' }
      post { success { archiveArtifacts artifacts: 'app.tgz', fingerprint: true } }
    }

    stage('Deploy') {
      steps {
        sshagent (credentials: [ "${CRED_ID}" ]) {
          sh '''
            set -euo pipefail
            GIT_SHORT=$(git rev-parse --short HEAD)
            APP_VERSION="build-${BUILD_NUMBER}-$(date -u +%Y%m%d-%H%M)-$GIT_SHORT"

            scp -o StrictHostKeyChecking=accept-new app.tgz rocky@${APP_HOST}:/tmp/app.tgz
            ssh -o StrictHostKeyChecking=accept-new rocky@${APP_HOST} '
              set -euo pipefail
              APP_DIR="'${APP_DIR}'"

              sudo mkdir -p "$APP_DIR"
              sudo chown -R appuser:appuser "$APP_DIR"
              sudo -u appuser tar xzf /tmp/app.tgz -C "$APP_DIR"
              cd "$APP_DIR"
              if [ -f package-lock.json ]; then sudo -u appuser npm ci; else sudo -u appuser npm install; fi

              # injeta versão no systemd
              echo APP_VERSION='${APP_VERSION}' | sudo tee /etc/sap-sim.env >/dev/null
              sudo mkdir -p /etc/systemd/system/sap-sim.service.d
              printf "[Service]\nEnvironmentFile=/etc/sap-sim.env\n" | sudo tee /etc/systemd/system/sap-sim.service.d/10-env.conf >/dev/null

              sudo systemctl daemon-reload
              sudo systemctl restart sap-sim

              # espera a app abrir a 3000
              for i in {1..30}; do sudo ss -lntp | grep -q ":3000" && break; sleep 1; done
              sudo systemctl is-active --quiet sap-sim
            '
          '''
        }
      }
    }

    stage('Health') {
      steps {
        sh '''
          set -euo pipefail

          # 1) check local na própria EC2 (evita falso negativo de rede)
          ssh -o StrictHostKeyChecking=accept-new rocky@${APP_HOST} "curl -sSf http://localhost:3000/health >/dev/null"

          # 2) check público (Nginx) com retry por 2 minutos
          PUB="${APP_PUBLIC}/health"
          for i in {1..24}; do
            code=$(curl -s -o health.json -w '%{http_code}' "$PUB" || true)
            if [ "$code" = "200" ]; then
              cat health.json
              exit 0
            fi
            sleep 5
          done
          echo "Healthcheck falhou em '$PUB' (último status: $code)"
          exit 1
        '''
      }
      post { always { archiveArtifacts artifacts: 'health.json', allowEmptyArchive: true } }
    }
  }
}
