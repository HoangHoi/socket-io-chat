$(function() {
    // const FADE_TIME = 150; // ms
    const TYPING_TIMER_LENGTH = 400; // ms
    const COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
    ];

    const $window = $(window);
    const $registerModal = $('#register-modal');
    const $registerModalButton = $('#register-modal-button');
    const $usernameInput = $('#user-name-input');
    const $chatPage = $('#chat-page');
    const $chatInput = $('#chat-input');
    const $messages = $('#messages');
    const $userTyping = $('#user-typing');
    const $typing = $('#typing');
    const $userNameHeader = $('#user-name-header');
    const $userName = $('#user-name');
    const $users = $('#users-list');

    var username;
    var connected = false;
    var typing = false;
    var userTyping = [];
    var users = [];

    var socket = io();
    // var socket = io({
    //     transports: ['polling', 'websocket']
    // });

    $registerModal.modal({
        backdrop: 'static',
        keyboard: false
    });

    $registerModal.modal('show');

    function setUsername() {
        username = $usernameInput.val();

        if (username) {
            $registerModal.modal('hide');
            $chatPage.show();
            $userName.text(username);
            $userNameHeader.show();
        }
    }

    function getUsernameColor(name) {
        var hash = 7;
        for (var i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + (hash << 5) - hash;
        }
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }

    function cleanInput(input) {
        return $('<div/>').text(input.trim()).text();
    }

    function sendMessage() {
        socket.emit('stop_typing');
        typing = false;
        var message = $chatInput.val();
        message = cleanInput(message);
        console.log(message && connected);
        if (message && connected) {
            $chatInput.val('');
            addChatMessage({
                username: username,
                message: message
            });
            socket.emit('new_message', message);
        }
    }

    function addChatMessage(data) {
        var $usernameDiv = $('<div class="user-name">')
            .text(data.username)
            .css('color', getUsernameColor(data.username));

        var $messageBodyDiv = $('<div />')
            .text(data.message);

        var $messageDiv = $('<div class="d-flex flex-wrap flex-md-nowrap align-items-center pt-2 pb-2"/>')
            .data('username', data.username)
            .append($usernameDiv, $messageBodyDiv);

        addMessageElement($messageDiv);
    }

    function addMessageElement(el) {
        var $el = $(el);
        $messages.append($el);
        window.scrollTo(0, document.body.scrollHeight);
    }

    function renderUserTyping() {
        if (userTyping.length > 0) {
            $userTyping.text(userTyping.join(', '));
            $typing.show();
            console.log(userTyping.join(', '));
            return;
        }

        console.log('typing hide');
        $userTyping.text('');
        $typing.hide();
        return;
    }

    function renderUsers() {
        $users.empty();
        for (var i = 0; i < users.length; i++) {
            var item = $('<li class="nav-item pt-2 pb-2 border-bottom" />').text(users[i]);
            $users.append(item);
        }
    }

    function updateTyping () {
        if (connected) {
            if (!typing) {
                typing = true;
                socket.emit('typing');
            }
            lastTypingTime = (new Date()).getTime();

            setTimeout(function () {
                var typingTimer = (new Date()).getTime();
                var timeDiff = typingTimer - lastTypingTime;
                if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
                socket.emit('stop_typing');
                typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }

    function emitEvAddUser() {
        var inputName = $usernameInput.val().trim();
        if (inputName) {
            socket.emit('add_user', inputName);
        }
    }

    $window.keydown(function(event) {
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            if (username) {
                $chatInput.focus();
            } else {
                $usernameInput.focus();
            }
        }

        if (event.which === 13) {
            if (username) {
                sendMessage();
            } else {
                emitEvAddUser();
            }
        }
    });

    $chatInput.on('input', function() {
        updateTyping();
    });

    $registerModalButton.on('click', function() {
        emitEvAddUser()
    });

    socket.on('login', function() {
        connected = true;
        console.log('User login success!');
        setUsername();
        socket.emit('all_users');
    });

    socket.on('login_fail', function() {
        alert('Vui lòng đăng nhập bằng tên khác!');
    });

    socket.on('new_message', function(data) {
        addChatMessage(data);
    });

    socket.on('typing', function(data) {
        if (userTyping.findIndex(function(item) {return item == data.username;}) == -1) {
            console.log('New user typing: ' + data.username);
            userTyping.push(data.username);
            renderUserTyping();
        }
    });

    socket.on('stop_typing', function (data) {
        var userTypingIndex = userTyping.findIndex(function(item) {return item == data.username;});
        if (userTypingIndex != -1) {
            userTyping.splice(userTypingIndex, 1);
            renderUserTyping();
        }
    });

    socket.on('user_joined', function(data) {
        if (users.findIndex(function(item) {return item == data.username;}) == -1) {
            console.log('New user join: ' + data.username);
            users.push(data.username);
            renderUsers();
        }
    });

    socket.on('user_left', function (data) {
        console.log('user_left', data);
        var userLeftIndex = users.findIndex(function(item) {return item == data.username;});
        if (userLeftIndex != -1) {
            users.splice(userLeftIndex, 1).values();
            console.log(users);
            renderUsers();
        }
    });

    socket.on('disconnect', function() {
        console.log('You have been disconnected!');
    });

    socket.on('reconnect', function() {
        console.log('You have been reconnected!');
        if (username) {
            socket.emit('add_user', username);
        }
    });

    socket.on('reconnect_error', function() {
        console.log('Reconnect has failed');
    });

    socket.on('server_name', function(serverName) {
        console.log('Server name: ' + serverName);
    });

    socket.on('all_users', function(data) {
        users = data;
        renderUsers();
        console.log('Users: ', users);
    });
});
