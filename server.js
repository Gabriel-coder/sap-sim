import express from 'express'; import Redis from 'ioredis';
const app = express(); const redis = new Redis(); // localhost:6379
app.get('/health', async (_req,res)=>{ try{ await redis.ping(); res.json({ok:true,redis:'up'}); }
catch(e){ res.status(500).json({ok:false,redis:'down',err:String(e)}) }});
app.get('/orders/:id',(req,res)=>res.json({id:req.params.id,status:'ok'}));
app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('SAP-sim up'));
