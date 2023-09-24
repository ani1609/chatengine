import { useEffect, useState } from 'react';
import axios from "axios";
import '../index.css';
import '../styles/Chat.css';
import * as openpgp from 'openpgp/lightweight';
import {ReactComponent as Group} from '../icons/group.svg';
import {ReactComponent as Options} from '../icons/options.svg';
import { useTheme } from './ThemeContext';




function Chat(props) 
{
	const { user, socket, roomId, roomName, groupProfilePic} = props;
    const [plainText, setPlainText] = useState('');
	const [previousMessages, setPreviousMessages] = useState([]);
	const [creator, setCreator] = useState('');
	const [roomMembers, setRoomMembers] = useState([]);
	const [timestamp, setTimestamp] = useState(Date.now());
	const [publicKeys, setPublicKeys] = useState([]);
    const [messages, setMessages] = useState([]);
    const { dark, setDark } = useTheme();



	useEffect(() =>
    {
        socket.on('join_room', (data) =>
        {
            console.log(data.user.name," joined the chat");
            setRoomMembers((roomMembers) => [...roomMembers, data.user]);
            setPublicKeys((publicKeys) => [...publicKeys, data.user.armoredPublicKey]);
        });
    }, [socket]);


	useEffect(() => 
	{
		console.log("roomClick is true, setting room messages to null");
		setMessages([]);
	}, [roomId]);


	const decryptMessages = async (message) =>
	{
		try
		{
			const { data: decrypted } = await openpgp.decrypt
			({
				message: await openpgp.readMessage({ armoredMessage: message }),
				decryptionKeys: await openpgp.readPrivateKey({ armoredKey: user.encryptedPrivateKey }),
			});
			return decrypted;
		}
		catch(error)
		{
			// console.error("Error in decrypting message ",error);
		}
	}



	const getJoinedRoomsAdvancedDetails = async (roomId) =>
	{
		console.log("getJoinedRoomsAdvancedDetails called ",roomId);
		try
        {
            const response = await axios.get(`http://localhost:3000/api/chat/getJoinedRoomsAdvancedDetails?roomId=${roomId}`);
            console.log(response.data);
			setCreator(response.data.rooms.creator);
			setRoomMembers(response.data.rooms.roomMembers);
			setTimestamp(response.data.rooms.timestamp);
			const decrypted = await Promise.all(response.data.rooms.chats.map(chat => decryptMessages(chat.message)));
			const chats = response.data.rooms.chats.map((chat, index) =>
			{
				chat.message = decrypted[index];
				return chat;
			});
			setPreviousMessages(chats);
			setPublicKeys(response.data.rooms.roomMembers.map(member => member.armoredPublicKey));
			console.log("chats are ",chats);
			console.log("encrypted chats are ",response.data.rooms.chats);
        }
		catch (error)
		{
			console.error("Error fetching data:", error);
		}
	}


	useEffect(() =>
	{
		if (roomId)
		{
			getJoinedRoomsAdvancedDetails(roomId);
		}
	}, [roomId]);


	useEffect(() => 
	{
		socket.on('receive_message', async (data) => 
		{
			const decrypted = await decryptMessages(data.data.message);
			data.data.message = decrypted;
			setMessages((messages) => [...messages, data.data]);
		});
	}, [socket]);

  
    const handleSendMessage = async (e) => 
    {
        e.preventDefault();
		let encrypted;
        if (plainText && user && user.name && publicKeys) 
		{
			const unArmoredPublicKeys = await Promise.all(publicKeys.map(armoredKey => openpgp.readKey({ armoredKey : armoredKey })));
			const message = await openpgp.createMessage({ text: plainText });
    		encrypted = await openpgp.encrypt({
				message,
				encryptionKeys: unArmoredPublicKeys,
			});
			socket.emit('send_message', { roomId, message : encrypted, senderName: user.name, senderEmail: user.email, timeStamp: Date.now() });
			setPlainText('');
		}
		try
		{
			const response = await axios.post('http://localhost:3000/api/chat/upload', { roomId, message : encrypted, senderEmail: user.email, timeStamp: Date.now() });
			console.log(response.data);
		}
		catch(error)
		{
			console.error("Error in sending message ",error);
		}
    };



    return (
      	<div className={dark ? 'chat_parent dark_bg' : 'chat_parent light_bg'}>
			<div className='group_header' style={{ borderBottom: dark ? '1px solid rgb(78, 78, 78)' : '1px solid rgb(165, 165, 165)' }}>
				{!groupProfilePic && <Group className={dark ? 'group_profile_pic_dark' : 'group_profile_pic_light'}/>}
				<div>
					<h3 className={dark ? 'r_name dark_primary-font' : 'r_name light_primary-font'}>{roomName}</h3>
					<p className={dark ? 'creator dark_secondary-font' : 'creator light_secondary-font'}>Created by {creator} on {timestamp}</p>
				</div>
				<Options className={dark ? 'options dark_hover' : 'options light_hover'}/>
			</div>
			<p>{roomId}</p>
			<form>
				{previousMessages.map((data, index) => (
					<div key={index} className='previous_messages'>
						<p>PREV {data.message}</p>
					</div>
				))}

				{messages.map((data, index) => (
					<div key={index} className='message'>
						<p>RECENT {data.message}</p>
					</div>
				))}

				

				<input
					type='text'
					id="message"
					autoComplete="off"
					value={plainText}
					onChange={(e) => setPlainText(e.target.value)}
					required
				/>
				<button type='submit' onClick={handleSendMessage}>Send</button>
			</form>
    	</div>
    );
}

export default Chat;
