const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const moment = require("moment");

const dexonglobal = require("./dexonglobal/routes/router");

const fileUpload = require("express-fileupload");
const path = require("path");

const httpServer = http.createServer(app);
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    credentials: true,
    optionSuccessStatus: 200,
  },
});

io.on("connection", (socket) => { });
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use(fileUpload());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/rental_images",
  express.static(path.join(__dirname, "rental_images")),
);
app.use("/exports", express.static("public/exports"));


const PORT = process.env.PORT || 2000;

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

app.use("/api/v9", dexonglobal);

app.use(express.static(path.join(__dirname, "build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});


let x = true;
if (x) {
  console.log("Waiting for the next minute to start...");
  const now = new Date();
  const secondsUntilNextMinute = 60 - now.getSeconds();
  console.log(
    "start after ",
    moment(new Date()).format("HH:mm:ss"),
    secondsUntilNextMinute,
  );
  setTimeout(() => {
    // generatedTimeEveryAfterEveryOneMin(io);
    // rouletteResult5Star(io);

    // wingoResults();
    // wingoResults30Sec();
    x = false;
  }, secondsUntilNextMinute * 1000);
}



app.get("/", async (req, res) => {
  return res.status(200).json({
    msg: "Everything is good.",
  });
});

httpServer.listen(PORT, async () => {
  // await createStream();
  console.log("Server listening on port", PORT);
});
