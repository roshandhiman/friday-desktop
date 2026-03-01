const express = require("express");
const app = express();
app.use(express.json());

app.get("/health", (req,res)=>{
  res.json({status:"ok"});
});

app.listen(5000, ()=>console.log("Backend running on 5000"));
