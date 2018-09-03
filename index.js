require('dotenv').config();
let debug = require('debug')('socketio-chat@root');
let express = require('express');
let app = express();
// let path = require('path');
let server = require('http').createServer(app);
let io = require('socket.io')(server);
let redis = require('socket.io-redis');

const port = process.env.PORT || 3000;
const serverName = process.env.NAME || 'Unknown';
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT || 6379;

io.adapter(redis({ host: redisHost, port: redisPort }));

app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

server.listen(port, () => {
    debug('Server listening at port %d', port);
    debug('Server name: ', serverName);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Health check
app.head('/health', function (req, res) {
    res.sendStatus(200);
});

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

const getAllUsers = () => {
    var users = [];
    const socketIds = Object.keys(io.sockets.sockets);
    for (var i = 0; i < socketIds.length; i++) {
        users.push(io.sockets.sockets[socketIds[i]].username);
    }

    return users;
}

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

        io.of('/').adapter.customRequest({message: 'get_all_users'}, (err, replies) => {
            const allUsers = [].concat.apply([], replies);
            socket.emit('all_users', allUsers);
        });

    });
};

// on every node
io.of('/').adapter.customHook = (data, callback) => {
    if (typeof callback !== 'function'){
        debug('Invalid callback customHook: ', data, callback);
        return;
    }

    if (data && data.message == 'get_all_users') {
        return callback(getAllUsers());
    }

    callback();
}

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
