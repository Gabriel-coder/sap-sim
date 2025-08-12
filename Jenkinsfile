pipeline {
  agent any
  options { timestamps() }
  environment {
    APP_HOST = "10.70.1.170"      // IP privado da APP
    APP_DIR  = "/opt/sap-sim"
    CRED_ID  = "app-ssh"
    APP_URL  = "http://107.20.96.191/health"  // health via Nginx público
  }
  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Build & Test') {
      steps { sh '''
        set -e
        [ -f package-lock.json ] && npm ci || npm install
        npm test
      ''' }
    }

    stage('Package') {
      steps { sh 'tar czf app.tgz --exclude=node_modules --exclude=.git .' }
      post { success { archiveArtifacts artifacts: 'app.tgz', fingerprint: true } }
    }

    stage('Deploy') {
      steps {
        sshagent(credentials: [env.CRED_ID]) {
          sh """
            set -e
            scp -o StrictHostKeyChecking=accept-new app.tgz rocky@${APP_HOST}:/tmp/app.tgz
            ssh -o StrictHostKeyChecking=accept-new rocky@${APP_HOST} "
              set -e
              APP_DIR='${APP_DIR}'
              sudo mkdir -p \"\$APP_DIR\"
              sudo chown -R appuser:appuser \"\$APP_DIR\"
              sudo -u appuser tar xzf /tmp/app.tgz -C \"\$APP_DIR\"
              cd \"\$APP_DIR\"
              if [ -f package-lock.json ]; then sudo -u appuser npm ci; else sudo -u appuser npm install; fi
              sudo systemctl restart sap-sim
              sudo systemctl is-active --quiet sap-sim
            "
          """
        }
      }
    }

    stage('Health') {
      steps { sh 'curl -sSf ${APP_URL} | tee health.json' }
    }
  }
}
