// I DONT WANT TO USE WEBPACK. IT'S A PITA
declare function io(...args: any[]): any;

function printToConsole(message: string) {
    const $consoleElement = $("#console_output");

    const msg = message.split("\n");

    for (let i = 0;i < msg.length;i++) {
        $consoleElement.children(":last-child").clone().text(msg[i]).appendTo($consoleElement);
    }

    // Scroll to bottom
    const $consoleOutput = $("#console_output");
    $consoleOutput.scrollTop($consoleOutput[0].scrollHeight);
}

function log(...args: any[]): void {
    const arg = [...args];
    const msg = arg.shift();

    let print = msg;

    if (arg.length > 0)
        print += ", " + arg.join(", ");

    printToConsole(print);

    console.log(...args);
}

// Connect to websocket
$(async() => {
    const socket = io();

    socket.on("connect", () => {
        log("Successfully connected to host server");
    });
    socket.on("disconnect", () => {
        log(`Disconnected from host server`);
    });

    socket.on("connect_error", (err: any) => {
        log(`Connection error: ${err}`);
    });

    const $input = $("#console_input input");

    let authenticated = false;

    socket.on("disconnect", () => {
        authenticated = false;
    });

    $input.on("keypress", (e) => {
        if(e.which === 13) {
            const val = ($input.val() || "").toString().toLowerCase();
            
            // Reset input value
            $input.val("");

            const args = val.split(" ");

            if (authenticated) {
                if (args[0] === "start") {
                    socket.emit("event", "start");
                } else if (args[0] === "stop") {
                    socket.emit("event", "stop");
                } else {
                    socket.emit("command", args);
                }
            } else if (args[0] === "auth") {
                if (args.length > 1) {
                    const auth = args[1];

                    socket.once("auth_response", (response: boolean) => {
                        authenticated = response;
                        log("Authentication response: " + response);
                    });

                    socket.emit("auth", auth);
                }
            }

            log("> " + val);

            // Scroll to bottom
            const $consoleOutput = $("#console_output");
            $consoleOutput.scrollTop($consoleOutput[0].scrollHeight);
        }
    });

    socket.on("log", (msg: string) => {
        log("Server: " + msg);
    });
});