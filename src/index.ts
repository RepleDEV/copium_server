import express from "express";
import path from "path";
import { promises as fs, existsSync } from "fs";
import { Server } from "socket.io"

const app = express();
const PORT = +(process.env.PORT || 9103); // default port to listen
const AUTH = process.env.AUTH || "abc123";

// Define a route handler for the default home page
app.get("/", (req, res) => {
    res.sendFile(path.resolve("./res/index.html"))
});

app.get("/script", (req, res) => {
    res.sendFile(path.resolve("./out/public/scripts/index.js"));
});
app.get("/styles", (req, res) => {
    res.sendFile(path.resolve("./public/styles/styles.css"));
})

let io: Server;
// This doesn't include the admin
let connectedClients = 0;

function start(): boolean {
    // 3, Client1, Client2, Admin (admin HAS to be there :D)
    if (connectedClients != 2)
        return false;

    io.emit("event", "start");

    started = true;

    return true;
}
async function finish(): Promise<string> {
    const filepath = `./public/results/results-${Date.now()}.json`;
    await createDir(path.resolve("./public/results"));
    await fs.writeFile(path.resolve(filepath), JSON.stringify(pingResults));

    started = false;

    return filepath;
}

async function createDir(dir: string): Promise<void> {
    if (!existsSync(dir)) {
        await fs.mkdir(dir);
    }
}
async function getResults(): Promise<string[]> {
    const dir = path.resolve("./public/results")

    if (existsSync(dir)) {
        return await fs.readdir(dir);
    }
    return [];
}

// Start the express server
const server = app.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
});

io = new Server(server);

let started = false;
let pingResults: { hostname: string, n: number, time: number }[] = [];

io.sockets.on("connection", (socket) => {
    console.log("Socket connected");
    connectedClients++;

    socket.on("disconnect", () => {
        connectedClients--;

        io.to("admin").emit("log", "Client disconnected");

        if (started) {
            started = false;
            io.to("admin").emit("log", "Procedure has been interrupted. Cancelling.");

            finish().then((filename) => {
                io.to("admin").emit("log", `Results saved in: ${filename}`);
            });
        }
    });

    io.to("admin").emit("log", "Client connected");

    socket.on("auth", (auth) => {
        if (auth === AUTH) {
            socket.emit("auth_response", true);
            socket.join("admin");
    
            console.log("Admin joined");

            return;
        }

        socket.emit("auth_response", false);
    });

    socket.on("command", (args) => {
        if (Array.from(socket.rooms.keys()).includes("admin")) {
            if (args[0] === "get") {
                const req = args[1];
    
                if (req === "client_count") {
                    io.to("admin").emit("log", `Connected Clients: ${connectedClients}`);
                }
                if (req === "results") {
                    getResults().then((results) => {
                        io.to("admin").emit("log", `Results: \n- ${results.join("\n- ")}`);
                    });
                }
            }
        }
    });

    socket.on("event", (e, ...args) => {
        switch (e) {
            case "start":
                if (Array.from(socket.rooms.keys()).includes("admin")) {
                    if (!started) {
                        const started = start();
    
                        let message = "";
    
                        if (started) {
                            message = "Successfully Started Procedure.";
                        } else {
                            message = "Unable to start procedure. Not enough clients.";
                        }
    
                        io.to("admin").emit("log", message);
                    } else {
                        io.to("admin").emit("log", "Procedure has already started.");
                    }
                }
                break;
            case "stop":
                io.to("admin").emit("log", "Stopping...");
                io.emit("event", "stop");
                break;
            case "ping":
                pingResults = args[0];
                io.to("admin").emit("log", "Client ping.")
                break;
            case "finish":
                io.to("admin").emit("log", "Procedure finished");
                finish().then((filename) => {
                    io.to("admin").emit("log", `Results saved in: ${filename}`);
                });
                break;
            default:
                break;
        }
    });
});