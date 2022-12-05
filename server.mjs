import http from "http";
import fs from "node:fs/promises";
import path from "path";
import formidable from "formidable";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
// 获取 __dirname 的 ESM 写法
const __dirname = dirname(fileURLToPath(import.meta.url));

const { errors: formidableErrors } = formidable;

const app = http.Server(handleRequest);
const tmpPath = path.resolve(__dirname, "tmp");

async function init() {
  try {
    await fs.mkdir(tmpPath);
  } catch (error) {}
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleRequest(req, res) {
  if (req.url === "/") {
    const fd = await fs.open("./index.html");
    fd.readFile().then((data) => {
      res.write(data);
      res.end();
    });
    fd.close();
  } else if (req.url === "/upload" && req.method === "POST") {
    handleUpload(req, res);
  } else if (req.url === "/merge" && req.method === "POST") {
    handleMerge(req, res);
  } else if (req.url === "/checkStatus" && req.method === "POST") {
    handleCheckStatus(req, res);
  } else {
    handleServerError(res);
  }
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleUpload(req, res) {
  // parse a file upload
  const form = formidable({});

  form.parse(req, async (err, fields, files) => {
    if (err) {
      // example to check for a very specific error
      if (err.code === formidableErrors.maxFieldsExceeded) {
      }
      res.writeHead(err.httpCode || 400, { "Content-Type": "text/plain" });
      res.end(String(err));
      return;
    }
    let fileName = files.file.originalFilename;
    let result;
    const idx = fileName.lastIndexOf(".");
    if (idx > -1) {
      fileName = `${fields.fileId}${fileName.substring(idx)}`;
    }
    if ("chunkNo" in fields) {
      // 分片上传
      fileName = `${fields.chunkNo}.chunk`;
      const filePath = path.resolve(tmpPath, fields.fileId);
      fs.opendir;
      try {
        await fs.stat(filePath);
      } catch (err) {
        if (err && err.code !== "ENOENT") {
          handleServerError(res);
          return;
        }
        await fs.mkdir(filePath).catch(() => {});
      }
      result = await writeFile(files.file.filepath, path.resolve(filePath, fileName));
      if (!(res instanceof Error)) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(JSON.stringify({ msg: "success", chunkNo: fields.chunkNo }));
        return;
      }
    } else {
      // 写入单个文件
      result = await writeFile(files.file.filepath, path.resolve(tmpPath, fileName));
    }
    if (!(result instanceof Error)) {
      res
        .writeHead(200, {
          "content-type": "application/json;charset=UTF-8",
        })
        .end(JSON.stringify({ path: result }));
      return;
    }
  });
}

async function writeFile(originPath, targetPath) {
  let fw;
  try {
    fw = await fs.open(targetPath, "w");
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      return err;
    }
  }
  const fr = await fs.open(originPath);
  const fread = fr.createReadStream();
  const fwrite = fw.createWriteStream({
    flags: "a",
  });
  fread.pipe(fwrite);
  return targetPath;
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleMerge(req, res) {
  const data = [];
  req.on("data", (chunk) => {
    data.push(chunk);
  });
  req.on("end", async () => {
    const buf = Buffer.concat(data);
    const _data = buf.toString("utf-8");
    const { fileId, fileName, total } = JSON.parse(_data);
    let left = Number(total);
    let i = 0;
    const fn = async () => {
      const fd = await fs.open(path.resolve(tmpPath, fileName), "a+");
      const chunkFd = await fs.open(path.resolve(tmpPath, fileId, `${i}.chunk`));
      const data = await chunkFd.readFile();
      await fd.appendFile(data);
      i++;
      left--;
      chunkFd.close();
      fd.close();
      if (left === 0) {
        // 一天后删除 fs.rmdir()
        res
          .writeHead(200, {
            "content-type": "application/json;charset=UTF-8",
          })
          .end(
            JSON.stringify({
              msg: "ok",
            })
          );
      } else {
        fn();
      }
    };
    fn();
  });
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleCheckStatus(req, res) {
  const data = [];
  req.on("data", (chunk) => {
    data.push(chunk);
  });
  req.on("end", async () => {
    const buf = Buffer.concat(data);
    const _data = buf.toString("utf-8");
    const { fileId } = JSON.parse(_data);
    fs.opendir(path.resolve(tmpPath, fileId))
      .then(async (dir) => {
        const arr = [];
        for await (const dirent of dir) {
          if (dirent.name.endsWith(".chunk")) {
            arr.push(Number(dirent.name.substring(0, dirent.name.length - 6)));
          }
        }
        res
          .writeHead(200, {
            "content-type": "application/json;charset=UTF-8",
          })
          .end(JSON.stringify({ data: arr }));
      })
      .catch((err) => {
        res
          .writeHead(200, {
            "content-type": "application/json;charset=UTF-8",
          })
          .end(JSON.stringify({ data: [] }));
      });
  });
}

/**
 * @param {http.ServerResponse} res
 */
function handleServerError(res) {
  res.writeHead(500, { "Content-Type": "text/plain" });
  res.end("Server error");
}

console.log("server running at: ");
console.log("\x1B[32m%s\x1B[0m", "  http://localhost");
init();
app.listen(80);
