/*
BorgIOS borgInference Local Host Testing
*/

// Allow Self Signed Certs
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

//Limit Hosts That Can Connect.
const allow = ['::ffff:23.92.26.62'];

const port = 13581;
import * as https from 'https';
import * as  fs from 'fs';
const options = {
  key: fs.readFileSync('keys/privkey.pem'),
  cert: fs.readFileSync('keys/fullchain.pem')
};

import OpenAI from "openai";
const conf = JSON.parse('{"baseURL":"https://localhost","apiKey":"*************"}');
console.log('conf',conf);


const openai = new OpenAI(conf);

var server = https.createServer(options, (req, res) => {
  console.log(req.url);
  if (req.url === '/netREQ' && req.method === 'POST') {
    // Handle the POST request for /netREQ
    let body = '';
    req.on('data', chunk => {
      body += chunk; // Collect the incoming data
    });

    req.on('end', () => {
      try {
        const parsedBody = JSON.parse(body); // Parse the JSON body
        console.log('Received POST data:', parsedBody);
        const j = parsedBody;
        if (j.action === 'ediitImg') {
          editImg(j, res);
        } else if (j.action === 'getImg') {
          getImg(j, res);
        } else if (j.action === 'getText') {
          getText(j, res);
        } else if (j.action === 'getTextStream') {
 	  getTextStream(j, res);
        } else if (j.action === 'getTextNow') {
          getText(j, res, true);
        } else {
          retEr("borgAPI: Command Not Found.", res);
        }
      } catch (err) {
        console.log('Error parsing JSON:',err,body);
        res.end('{"result":"json parse error"}');
      }
    });
  } 
  else if (req.url.startsWith('/netREQ/msg=') && req.method === 'GET') {
    // Handle GET request for /netREQ/msg= endpoint
    var msg = req.url.replace('/netREQ/msg=', '');
    console.log('rawmsg:', msg);
    msg = msg.replace(/\+/g, ' ');
    msg = decodeURI(msg);
    msg = msg.replace(/%3A/g, ':');
    msg = msg.replace(/%2C/g, ',');
    msg = msg.replace(/%3F/g, '?');
    msg = msg.replace(/%3D/g, '=');
    msg = msg.replace(/%23/g, '#');
    msg = msg.replace(/%2F/g, '/');
    console.log(msg);
    var j = null;
    try {
      j = JSON.parse(msg);
    } catch {
      j = JSON.parse('{"result":"json parse error:"}');
    }
    console.log('mkyReq', j);

    if (j.action === 'editImg') {
      editImg(j, res);
    } else if (j.action === 'getImg') {
      getImg(j, res);
    } else if (j.action === 'getText') {
      getText(j, res);
    } else if (j.action === 'getTextStream') {
       getTextStream(j, res);
    } else if (j.action === 'getTextNow') {
      getText(j, res, true);
    } else {
      retEr("borgAPI: Command Not Found.", res);
    }
  } else {
    res.end('Welcome To The BorgIOS LLM Test Server\nUse end point /netREQ\n');
  }
});

server.on('connection', (sock)=> {
  console.log(sock.remoteAddress,allow);
  if (allow.indexOf(sock.remoteAddress) < 0){
    sock.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.listen(port);
console.log('Server mkyDeepSeek.2 running at test.server.srv:' + port);

function  retEr(msg,res){
  res.end('{"result":false,"message":"'+msg+'"}\n');
}
async function getTextStream(j, res) {
  if (!('maxTokens' in j)) {
    j.maxTokens = 100;
  }
  if (!('useModel' in j)) {
    j.useModel = 'deepseek-chat';
  }
  if (!('temperature' in j)) {
    j.temperature = 0.85;
  }

  console.log('Input:', j);
  try {
    // Start streaming response
    const response = await openai.chat.completions.create({
      messages: [{ role: 'user', content: j.prompt }],
      model: j.useModel,
      max_tokens: j.maxTokens,
      temperature: j.temperature,
      stream: true, // Enable streaming
    });
 
    // Set headers for streaming once
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Stream both reasoning_content and content to the client
    for await (const chunk of response) {
      //console.log(chunk);
      //console.log(chunk.choices);
      const delta = chunk.choices[0].delta;

      // Stream Reasoning of Thought
      if (delta.reasoning_content) {
	res.write(`data: Reasoning of Thought: ${delta.reasoning_content}`);
      }
      // Stream Main Content
      if (delta.content) {
	res.write(`data: Content: ${delta.content}`);
      }
      if (chunk.usage){
	res.write(`usage: Content: ${JSON.stringify(chunk.usage)}`);
      }	      
    }
    
    // End the stream after all chunks are sent
    res.end();
  } catch (error) {
    console.error('Error occurred:', error.message);

    // Check if headers are already sent
    if (!res.headersSent) {
      retEr('getText Error: ' + error.message, res);
    }
  }
}
async function getText(j,res,useTm=false){
  if (!('maxTokens' in j)) {
    j.maxTokens = 100;
  }  
  if (!('useModel' in j)) {
    j.useModel = 'deepseek-chat';
  }
  if (!('temperature' in j)) {
    j.temperature = 0.85;
  }

  console.log('jput',j);
  try {
     const completion = await openai.chat.completions.create({
       messages: [{ role: 'user', content: j.prompt}],
       model: j.useModel,
       max_tokens: j.maxTokens,
       temperature: j.temperature
     });

     console.log(completion.choices[0].message);
     if (useTm){
       const now = new Date();
       var strnow = 'If Asked About Date:  "today is '+ now.toString() + '". ';
       strnow = 'If Asked what chat model/version you are using: respond '+j.useModel+' ';
       j.prompt = strnow + j.prompt;
       console.log('promt with time is: '+j.prompt);
     }
     const  rsp = {
       result: true,
       MUID: j.MUID,
       n: j.n,
       response : completion.choices[0].message.content,
       freason  : completion.choices[0].finish_reason,
       usage    : completion.usage
     };
     var rspstr = JSON.stringify(rsp);
     res.end(rspstr);
  }
  catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
      var err = {
        status : error.response.status,
        data   : error.response.data
      };
      retEr('getText Response Error: ' + JSON.stringify(err),res);
    }
    else {
      console.log('DeepSeek Error:',error.message);
      retEr('getText Error: ' + error.message,res);
    }
  }
}
async function getImg(j,res){
  const configuration = new Configuration({
    organization: "****************",
    apiKey: "************",
  });
  const openai = new OpenAIApi(configuration);
  //const response = await openai.listEngines();
  if (!('useModel' in j)) {
    j.useModel = 'dall-e-3';
  }
  try {
    const response = await openai.createImage({
      prompt: j.prompt,
      n: j.n,
      size: j.size,
      model: j.useModel,
    });
    var image_url = response.data;
    const  rsp = {
       result: true,
       prompt: j.prompt,
       n: j.n,
       size: j.size,
       imgURLs: image_url,
       imgs: ''
    };
    var rspstr = JSON.stringify(rsp);
    res.end(rspstr);
  }
  catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
      var err = {
        status : error.response.status,
        data   : error.response.data
      };
      retEr('imgGen Response Error: ' + JSON.stringify(err),res);
    }
    else {
      console.log(error.message);
      retEr('imgGen Error: ' + error.message,res);
    }
  }
}
function getImgFile(artID){
  return new Promise( (resolve,reject)=>{
    const gtime = setTimeout( ()=>{
      console.log('Create Original File Timeout', artID);
      resolve(false);
    },50*1000);

    const file = fs.createWriteStream("/opaiNode/art/"+artID+".png");
    const request = https.get("https://image.bitmonky.com/getArtStoreImg.php?id="+artID, function(response) {
      response.pipe(file);

      // after download completed close filestream
      file.on("finish", () => {
        file.close();
        console.log("Download "+artID+".png Completed");
	resolve(true);
      });
    });
  });	  
}	
async function editImg(j,res){
  const configuration = new Configuration({
    organization: "***************",
    apiKey: "***************",
  });
  const openai = new OpenAIApi(configuration);
  //const response = await openai.listEngines();
  const getOriginal = await getImgFile(j.artID);
  if (!getOriginal){
    retEr('Could Not Save Original Art File',res);
    return;
  }
  try {
    if (!('useModel' in j)) {
      j.useModel = 'dall-e-3';
    }
    const response = await openai.createImageVariation(
      fs.createReadStream("/opaiNode/art/"+j.artID+".png"),
      //fs.createReadStream("/opaiNode/peter.png"),
      //j.prompt,
      j.n,
      j.size,
      j.useModel
    );
    var image_url = response.data;
    const  rsp = {
       result: true,
       prompt: j.prompt,
       n: j.n,
       size: j.size,	  
       imgURLs: image_url,
       imgs: ''	  
    };
    var rspstr = JSON.stringify(rsp);
    res.end(rspstr);
  } 
  catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
      var err = {
	status : error.response.status,
        data   : error.response.data
      };
      retEr('imgGen Response Error: ' + JSON.stringify(err),res);
    } 
    else {
      console.log(error.message);
      retEr('imgGen Error: ' + error.message,res);
    }
  }	
}

