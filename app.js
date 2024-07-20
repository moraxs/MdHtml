const express = require('express');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const morgan = require('morgan');
const WebSocket = require('ws');

const app = express();
const wss = new WebSocket.Server({ noServer: true });

(async () => {
  const chalk = await import('chalk');

  app.use(express.static(path.join(__dirname, 'public')));

  morgan.token('method', (req) => chalk.default.blue(req.method));
  morgan.token('status', (req, res) => {
    const status = res.statusCode;
    if (status >= 500) {
      return chalk.default.red(status);
    } else if (status >= 400) {
      return chalk.default.yellow(status);
    } else if (status >= 300) {
      return chalk.default.cyan(status);
    } else if (status >= 200) {
      return chalk.default.green(status);
    }
    return status;
  });

  app.use(morgan(':method :url :status :res[content-length] - :response-time ms - :user-agent'));

  const markdownFilePath = path.join(__dirname, 'content', 'example.md');
  const outputHtmlFilePath = path.join(__dirname, 'index.html');

  const convertMarkdownToHtml = () => {
    fs.readFile(markdownFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading Markdown file:', err);
        return;
      }
      const htmlContent = marked(data);

      const fullHtmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rendered Markdown</title>
  <link rel="stylesheet" href="/css/github-markdown.min.css">
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: auto;
      padding: 20px;
    }
  </style>
</head>
<body class="markdown-body">
  <h1>Rendered Markdown</h1>
  <div>
    ${htmlContent}
  </div>
  <script>
    const socket = new WebSocket('ws://localhost:3000');
    socket.onmessage = function(event) {
      if (event.data === 'reload') {
        location.reload();
      }
    };
  </script>
</body>
</html>`;

      fs.writeFile(outputHtmlFilePath, fullHtmlContent, (err) => {
        if (err) {
          console.error('Error writing HTML file:', err);
          return;
        }
        console.log('index.html updated successfully');
        
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send('reload');
          }
        });
      });
    });
  };

  convertMarkdownToHtml();

  const watcher = chokidar.watch(markdownFilePath, {
    persistent: true,
  });

  watcher.on('change', (path) => {
    console.log(`检测到${path} 已更改, 重新渲染页面...`);
    convertMarkdownToHtml();
  });

  app.get('/', (req, res) => {
    res.sendFile(outputHtmlFilePath, (err) => {
      if (err) {
        console.error('Error sending HTML file:', err);
      } else {
        console.log('HTML file sent successfully');
      }
    });
  });

  const server = app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
  });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, socket => {
      wss.emit('connection', socket, request);
    });
  });

})();
