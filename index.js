require('dotenv').config();
let debug = require('debug')('socketio-chat@root');
let express = require('express');
let app = express();
let path = require('path');
let server = require('http').createServer(app);
let io = require('socket.io')(server);
let redis = require('socket.io-redis');

const port = process.env.PORT || 3000;
const serverName = process.env.NAME || 'Unknown';
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT || 6379;

io.adapter(redis({ host: redisHost, port: redisPort }));

server.listen(port, () => {
    debug('Server listening at port %d', port);
    debug('Server name: ', serverName);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

const checkUserName = (username) => {
    debug(username);
    if (!username || typeof username != 'string') return false;
    username = username.trim();
    debug(username);

    const socketIds = Object.keys(io.sockets.sockets);
    for (var i = 0; i < socketIds.length; i++) {
        if (io.sockets.sockets[socketIds[i]].username == username) {
            return false;
        }
    }

    return true;
};

const listenChatEvent = (socket) => {
    socket.on('new_message', (data) => {
        debug('New message: ', socket.username, '@' , data);
        socket.broadcast.emit('new_message', {
            username: socket.username,
            message: data
        });
    });

    socket.on('typing', () => {
        debug('Typing: ' + socket.username);
        socket.broadcast.emit('typing', {
            username: socket.username
        });
    });

    socket.on('stop_typing', () => {
        debug('Stop typing: ' + socket.username);
        socket.broadcast.emit('stop_typing', {
            username: socket.username
        });
    });

    socket.on('all_users', () => {
        debug('Request all users:  ' + socket.username);

        var users = [];
        const socketIds = Object.keys(io.sockets.sockets);
        for (var i = 0; i < socketIds.length; i++) {
            users.push(io.sockets.sockets[socketIds[i]].username);
        }

        socket.emit('all_users', users);
    });
};

// Chat socket.io
io.on('connection', (socket) => {
    socket.emit('server_name', serverName);

    let addedUser = false;

    socket.on('add_user', (username) => {
        if (!checkUserName(username)) {
            socket.emit('login_fail');
            return;
        }

        socket.username = username;
        debug('User joined: ' + username);
        socket.broadcast.emit('user_joined', {
            username: socket.username,
        });
        socket.emit('login');

        listenChatEvent(socket);
    });

    socket.on('disconnect', () => {
        debug('User left: ' + socket.username);
        socket.broadcast.emit('user_left', {
            username: socket.username,
        });
    });
});
