var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var moment = require('moment');
var fs = require('fs');
var app = express();
var http = require('http');
var server = http.createServer(app);
var smtpConfig = require('./config')
var smtp = require('smtp-server');
var smtpServer = new smtp.SMTPServer(smtpConfig);
const simpleParser = require('mailparser').simpleParser;

var io = require('socket.io')(server);
var sockets = [];
var emails = [];


io.on('connection', (socket) => {
    console.log('New user connection');
    sockets.push(socket);

    emails.forEach(email => {
        socket.emit('email', email);
    });

    socket.on('clearMessage', () => {
        emails = [];
    })

    socket.on('disconnect', () => {})
})

smtpServer.onAuth = (auth, session, callback) => callback(null, { user: 123 });

smtpServer.onMailFrom = (address, session, callback) => callback();

smtpServer.onRcptTo = (address, session, callback) => callback();

smtpServer.onData = (stream, session, callback) => {
    var timeStamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    var rcptTo = "";
    session.envelope.rcptTo.forEach(rcpt => {
        rcptTo += `${rcpt.address}_`;
    });
    rcptTo = rcptTo.substr(0, rcptTo.length - 1);
    //var fileName = `./emails/${timeStamp}_${session.envelope.mailFrom ? session.envelope.mailFrom.address : "error"}_to_${rcptTo}.txt`;

    streamToString(stream).then((source) => {
        simpleParser(source, {})
            .then(email => {
                var data = {
                    timeStamp,
                    email,
                    from: session.envelope.mailFrom.address
                };
                io.emit('email', data)
                emails.push(data);
            })
            .catch(err => {});

    })

    stream.on('end', callback);

};

function streamToString(stream) {
    const chunks = []
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk))
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
}

smtpServer.on("error", err => {
    console.log("Error %s", err.message);
});

// smtpServer.listen(465);
smtpServer.listen(smtpConfig.port);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

server.listen(process.PORT || 3000);