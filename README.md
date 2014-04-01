# Symple Video Chat Demo

The Symple video chat demo is an example of how to use the Symple protocol and libraries for instant messaging and WebRTC signalling. External projects used are AngularJS, Bootstrap, Node.js and Express. You're welcome to fork this repository and hack it to your hearts content.

## What is Symple?

Symple is a presence and messaging protocol which is semantically similar to XMPP, except that it is unrestrictive and vastly simplified, and it used JSON instead of XML for encoding messages. Symple also has a C++ client which makes it ideas for messaging and remoting between desktop, mobile and browser clients.

## How to use it

1. Clone the ```symple-server``` repository and fire up the Node.js server ```node server```. The server should be running on port 4500 and anonymous logins should be enabled since authentication is not implemented in our demo. See ```config.json``` in the server foot folder for config options.
2. Clone the ```symple-client-demo``` repository, and run the express server ```node app```.  
3. Open ```http://localhost:4400``` in your browser and play!

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## TODO

1. Store last 50 messages via json - store via server using a group cache options or flat file?
1. Sync with twitter API to get user info and profile photo for handles

## Contact

For more information on Symple please check out http://sourcey.com/symple/
For the C++ client see https://github.com/sourcey/libsourcey/tree/master/src/symple
