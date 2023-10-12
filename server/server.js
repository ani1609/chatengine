const express=require("express");
const connectDb = require('./configDB/MongoDB');
const {login, signup, authenticateJWT, uploadRoomId, getRoomId, editUserInfo, changePassword, deleteUsers}=require('./controllers/userController');
const {createRoom, joinRoom, getJoinedRoomsBasicDetails, getJoinedRoomsAdvancedDetails, uploadChat, getChat, deleteChats}=require('./controllers/chatRoomController');
const {uploadProfilePic, deleteProfilePic, addNewProfilePic}=require('./controllers/imageController');
const http=require('http');
const{ Server }=require('socket.io');
const cors=require('cors');
const multer=require('multer');

const app=express();
const port=3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use('/uploads', express.static('uploads'));


connectDb();


const server=http.createServer(app);

app.get('/', (req, res) => {
    res.send('Hello, worlddd!');
});


// --------user controllers--------
// deleteUsers();
app.post('/api/users/login', login);
app.post('/api/users/signup', signup);
app.get('/api/user', authenticateJWT, (req, res) => 
{
    res.json({ message: 'Protected route accessed successfully!', user: req.user });
});

// --------chatRoom controllers--------
// deleteChats();
app.post('/api/chat/upload', uploadChat);
app.post('/api/chat/getChat', getChat);
app.post('/api/chat/createRoom', createRoom);
app.post('/api/chat/joinRoom', joinRoom);
app.get('/api/user/getJoinedRoomsBasicDetails', getJoinedRoomsBasicDetails);
app.get('/api/chat/getJoinedRoomsAdvancedDetails', getJoinedRoomsAdvancedDetails);


// --------image controllers--------
const storage=multer.diskStorage(
{
    destination: function(req, file, cb)
    {
        cb(null, 'uploads/');
    }
    ,
    filename: function(req, file, cb)
    {
        cb(null, `${Date.now()}-${Math.round(Math.random()*1E9)}-${file.originalname}`);
    }
});
const upload=multer({storage: storage});
app.post('/api/uploadProfilePic', upload.single('profilePic'), uploadProfilePic);
app.post('/api/deleteProfilePic', deleteProfilePic);
app.post('/api/addNewProfilePic', upload.single('profilePic'), addNewProfilePic);




const io=new  Server(server,{
    cors: {
        origin: "http://localhost:3001",
        methods: ["GET", "POST"],
    },
});

io.on('connection', (socket) => 
{
    console.log('A user connected');

    // Store the joined rooms for each user
    const joinedRooms = [];

    // Handle create room
    socket.on('create_room', (roomId) => 
    {
        // Leave all previously joined rooms
        for (const room of joinedRooms) 
        {
            socket.leave(room);
        }
        socket.join(roomId);
        joinedRooms.push(roomId);
        console.log(`User created and joined a room: ${roomId}`);
    });

    // Handle new user joining room
    socket.on('join_room', (data) => 
    {
        // Leave all previously joined rooms
        for (const room of joinedRooms) 
        {
            socket.leave(room);
            console.log(`User left a room: ${room}`);
        }
        socket.join(data.roomId);
        joinedRooms.push(data.roomId);
        socket.broadcast.to(data.roomId).emit('join_room', { user: data.user, message: 'has joined this room.' });
        console.log(`User joined a room: ${data.roomId}`);
    });

    //handle send message
    socket.on('send_message', (data) => 
    {
        console.log("emmiting message");
        io.to(data.roomId).emit('receive_message', { data: data});
    });

    socket.on('disconnect', () => 
    {
        console.log('A user disconnected');
        // Leave all previously joined rooms when a user disconnects
        for (const room of joinedRooms) 
        {
            socket.leave(room);
        }
    });
});

server.listen(port, () =>
{
    console.log(`server is listening on port ${port}`);
});

