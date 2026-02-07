const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? '/index.html' : req.url);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
