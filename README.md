# Symple WebRTC Video Chat Demo

The Symple video chat demo is an example of how to use the Symple protocol and libraries for instant messaging and WebRTC signaling. External projects used are AngularJS, Bootstrap, Node.js and Express. You're welcome to fork this repository and hack it to your hearts content.

## What is Symple?

Symple is a presence and messaging protocol which is semantically similar to XMPP, except that it is unrestrictive and vastly simplified, and it used JSON instead of XML for encoding messages. Symple also has a C++ client which makes it ideas for messaging and remoting between desktop, mobile and browser clients.

## How to use it

1. Clone the `symple-server` repository and fire up the Node.js server `node server`. The server should be running on port 4500 and anonymous logins should be enabled since authentication is not implemented in our demo. See `config.json` in the server foot folder for config options.
2. Clone the `symple-client-demo` repository, and run the express server `node app`.  
3. Open `http://localhost:4400` in your browser and play!

### Hacking

Some key options are specified in the main HTML file located at `views/index.ejs`

**CLIENT_OPTIONS** This is the options hash for the Symple client and Socket.IO. This is where you specify the server URL and Peer object. Note that we have disabled 'websocket' transport by default, but you will probably want to re-enable it.

**WEBRTC_CONFIG** This is the PeerConnection options hash. In production you will want to specify some TURN servers so as to ensure the p2p connection is made.

Other than that all relevant JavaScript is located in `public/js/app.js` and `public/js/helpers.js`. Enjoy!

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## TODO

1. Store last 50 messages via json - store via server using a group cache options or flat file?.
2  Gruntfile for compressing scripts.
3. Sync with twitter API to get user info and profile photo for handles.

## Contact

For more information on Symple please check out http://sourcey.com/symple
There is also a blog post here http://sourcey.com/symple-webrtc-video-chat-demo
The current repository is located at https://github.com/sourcey/symple-client-demo
For the C++ client see https://github.com/sourcey/libsourcey/tree/master/src/symple
