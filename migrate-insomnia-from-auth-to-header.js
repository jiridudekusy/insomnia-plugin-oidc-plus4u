//Simple insmonia workspace migration tool which moves authentication from "Auth" section to "Headers" section

const fs = require("fs");

const fileName = "/Users/jdk/work/libra/usy_librag01_configuration/usy_librag01_configuration-server/test/insomnia/insomnia-workspace.json";
const PLUGIN_RE = /^({% plus4uToken [^,]*, [^,]*, [^,]*, [^,]*(?:, ([^,]+))?) %}$/

let wsStr = fs.readFileSync(fileName);
let ws = JSON.parse(wsStr);
ws.resources.filter(res => res._type === "request" && res.authentication && res.authentication.type === "bearer").forEach(req => {
  if (!req.headers) {
    req.headers = [];
  }
  req.headers = req.headers.filter(header => header.name != "Authorization");
  req.headers.push({
    name: "Authorization",
    value: `Bearer ${req.authentication.token}`
  });
  delete req.authentication;
});
ws.resources.filter(res => res._type === "environment").forEach(env => {
  Object.keys(env.data).forEach(key => {
    let match = env.data[key].match(PLUGIN_RE);
    if(match) {
      if(match[2]){
        env.data[key] = match[1]+", true %}";
      }else{
        env.data[key] = match[1]+", 'https://oidc.plus4u.net/uu-oidcg01-main/0-0', true %}";
      }
    }
  });
});
wsStr = JSON.stringify(ws, null, 2);
fs.writeFileSync(fileName, wsStr);
