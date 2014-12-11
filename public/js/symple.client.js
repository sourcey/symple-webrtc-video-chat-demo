// -----------------------------------------------------------------------------
// Symple Client
//
Symple.Client = Symple.Dispatcher.extend({
    init: function(options) {
        this.options = $.extend({
            url:     options.url ? options.url : 'http://localhost:4000',
            secure:  options.url && (
                         options.url.indexOf('https') == 0 || 
                         options.url.indexOf('wss') == 0) ? true : false,
            token:   undefined     // pre-arranged server session token
            //timeout: 0           // set for connection timeout
        }, options);
        this._super();
        this.peer = options.peer || {};
        this.roster = new Symple.Roster(this);
        this.socket = null;
    },

    // Connects and authenticates on the server.
    // If the server is down the 'error' event will fire.
    connect: function() {
        Symple.log('Symple Client: Connecting: ', this.options);
        self = this; 
        if (this.socket)
            throw 'The client socket is not null'
        this.socket = io.connect(this.options.url, this.options);
        this.socket.on('connect', function() {
            Symple.log('Symple Client: Connected');
            self.socket.emit('announce', {
                token:  self.options.token || "",
                group:  self.peer.group    || "",
                user:   self.peer.user     || "",
                name:   self.peer.name     || "",
                type:   self.peer.type     || ""
            }, function(res) {
                Symple.log('Symple Client: Announced: ', res);
                if (res.status != 200) {
                    self.setError('auth', res);
                    return;
                }
                self.peer = $.extend(self.peer, res.data);
                self.roster.add(res.data);
                self.sendPresence({ probe: true });
                self.doDispatch('announce', res);
                self.socket.on('message', function(m) {
                    //Symple.log('Symple Client: Receive: ', m);
                    if (typeof(m) == 'object') {     
                        switch(m.type) {
                            case 'message':
                                m = new Symple.Message(m); 
                                break;
                            case 'command':
                                m = new Symple.Command(m);
                                break;
                            case 'event':
                                m = new Symple.Event(m);
                                break;
                            case 'presence':
                                m = new Symple.Presence(m);
                                if (m.data.online)
                                    self.roster.update(m.data);
                                else
                                    self.roster.remove(m.data.id);
                                if (m.probe)
                                    self.sendPresence(new Symple.Presence({ to: m.from }));
                                break;
                            default:
                                o = m;
                                o.type = o.type || 'message';
                                break;
                        }
                    
                        if (typeof(m.from) != 'string') {
                            Symple.log('Symple Client: Invalid sender address: ', m);
                            return;
                        }
                            
                        // Replace the from attribute with the full peer object.
                        // This will only work for peer messages, not server messages.
                        var rpeer = self.roster.get(m.from);
                        if (rpeer)
                            m.from = rpeer;
                        else
                            Symple.log('Symple Client: Got message from unknown peer: ', m);
                        
                        // Dispatch to the application
                        self.doDispatch(m.type, m);
                    }
                });
            });
        });
        this.socket.on('error', function() {
            // This is triggered when any transport fails, 
            // so not necessarily fatal
            //self.setError('connect');          
            self.doDispatch('connect');   
        });
        this.socket.on('connecting', function() {
            Symple.log('Symple Client: Connecting');            
            self.doDispatch('connecting');
        });
        this.socket.on('reconnecting', function() {
            Symple.log('Symple Client: Reconnecting');            
            self.doDispatch('reconnecting');
        });
        this.socket.on('connect_failed', function() {
            // Called when all transports fail
            Symple.log('Symple Client: Connect failed');            
            self.doDispatch('connect_failed');
            self.setError('connect');   
        });
        this.socket.on('disconnect', function() {
            Symple.log('Symple Client: Disconnect');
            self.peer.online = false;
            self.doDispatch('disconnect');
        });
    },

    online: function() {
        return this.peer.online;
    },

    getPeers: function(fn) {
        self = this;
        this.socket.emit('peers', function(res) {
            Symple.log('Peers: ', res);
            if (typeof(res) != 'object')
                for (var peer in res)
                    self.roster.update(peer);
            if (fn)
                fn(res);
        });
    },

    send: function(m) {
        //Symple.log('Symple Client: Sending: ', m);
        if (!this.online()) throw 'Cannot send messages when offline';
        if (typeof(m) != 'object') throw 'Message must be an object';
        if (typeof(m.type) != 'string') m.type = 'message' //throw 'Message must have a type attribute';
        if (!m.id)  m.id = Symple.randomString(8);
        if (m.to && typeof(m.to) == 'object' && (m.to.group || m.to.user || m.to.id))
            m.to = Symple.buildAddress(m.to, this.peer.group);
        if (m.to && typeof(m.to) != 'string')
            throw 'Message \'to\' attribute must be an address string';
        if (m.to && m.to.indexOf(this.peer.id) != -1)
            throw 'Message sender cannot match the recipient';
        //if (typeof(m.to) == 'object' && m.to && m.to.id == m.from.id)
        //    throw 'The sender must not match the recipient';
        m.from = Symple.buildAddress(this.peer);
        Symple.log('Symple Client: Sending: ', m);
        this.socket.json.send(m);
    },
    
    respond: function(m) {      
        m.to = m.from;
        this.send(m);
    },

    sendMessage: function(m) { //, fn
        this.send(m); //, fn
    },

    sendPresence: function(p) {
        p = p || {};
        if (!this.online()) throw 'Cannot send message while offline';
        if (p.data) {
            p.data = Symple.merge(this.peer, p.data);
        }
        else
            p.data = this.peer;
        Symple.log('Symple Client: Sending Presence: ', p);
        this.send(new Symple.Presence(p));
    },

    sendCommand: function(c, fn, once) {
        var self = this;
        c = new Symple.Command(c);
        this.send(c);
        if (fn) {
            this.onResponse('command', {
                id: c.id
            }, fn, function(res) {
                if (once || (
                    // 202 (Accepted) and 406 (Not acceptable) response codes
                    // signal that the command has not yet completed.
                    res.status != 202 &&
                    res.status != 406)) {
                    self.clear('command', fn);
                }
            });
        }
    },

    // Adds a capability for our current peer
    addCapability: function(name, value) {        
        var peer = this.peer;
        if (peer) {
            if (typeof value == 'undefined')
                value = true
            if (typeof peer.capabilities == 'undefined')
                peer.capabilities = {}
            peer.capabilities[name] = value;
            //var idx = peer.capabilities.indexOf(name);
            //if (idx == -1) {
            //    peer.capabilities.push(name);
            //    this.sendPresence();
            //}
        }
    },

    // Removes a capability from our current peer
    removeCapability: function(name) {
        var peer = this.peer;
        if (peer && typeof peer.capabilities != 'undefined' && 
            typeof peer.capabilities[name] != 'undefined') {
            delete peer.capabilities[key];
            this.sendPresence();    
            //var idx = peer.capabilities.indexOf(name)
            //if (idx != -1) {
            //    peer.capabilities.pop(name);
            //    this.sendPresence();                
            //}
        }        
    },
    
    // Checks if a peer has a specific capbility and returns a boolean
    hasCapability: function(id, name) {
        var peer = this.roster.get(id)
        if (peer) {
            if (typeof peer.capabilities != 'undefined' && 
                typeof peer.capabilities[name] != 'undefined')
                return peer.capabilities[name] !== false;
            if (typeof peer.data != 'undefined' && 
                typeof peer.data.capabilities != 'undefined' && 
                typeof peer.data.capabilities[name] != 'undefined')
                return peer.data.capabilities[name] !== false;
        }
        return false;
    },
    
    // Checks if a peer has a specific capbility and returns the value
    getCapability: function(id, name) {
        var peer = this.roster.get(id)
        if (peer) {
            if (typeof peer.capabilities != 'undefined' && 
                typeof peer.capabilities[name] != 'undefined')
                return peer.capabilities[name];
            if (typeof peer.data != 'undefined' && 
                typeof peer.data.capabilities != 'undefined' && 
                typeof peer.data.capabilities[name] != 'undefined')
                return peer.data.capabilities[name];
        }
        return undefined;
    },

    // Sets the client to an error state and disconnect
    setError: function(error, message) {
        Symple.log('Symple Client: Client error: ', error, message);
        //if (this.error == error)
        //    return;
        //this.error = error;
        this.doDispatch('error', error, message);
        if (this.socket)
            this.socket.disconnect();
    },

    onResponse: function(event, filters, fn, after) {
        if (typeof this.listeners[event] == 'undefined')
            this.listeners[event] = [];
        if (typeof fn != 'undefined' && fn.constructor == Function)
            this.listeners[event].push({
                fn: fn,             // data callback function
                after: after,       // after data callback function
                filters: filters    // event filter object for matching response
            });
    },

    clear: function(event, fn) {
        Symple.log('Symple Client: Clearing callback: ', event);
        if (typeof this.listeners[event] != 'undefined') {
            for (var i = 0; i < this.listeners[event].length; i++) {
                if (this.listeners[event][i].fn === fn &&
                    String(this.listeners[event][i].fn) == String(fn)) {
                    this.listeners[event].splice(i, 1);
                    Symple.log('Symple Client: Clearing callback: OK: ', event);
                }
            }
        }
    },

    doDispatch: function() {
        // Modified dispatch function response callbacks first.
        // If a match is found event propagation will be terminated.
        if (!this.dispatchResponse.apply(this, arguments)) {
            this.dispatch.apply(this, arguments);
        }
    },

    dispatchResponse: function() {
        var event = arguments[0];
        var data = Array.prototype.slice.call(arguments, 1);
        if (typeof this.listeners[event] != 'undefined') {
            for (var i = 0; i < this.listeners[event].length; i++) {
                if (typeof this.listeners[event][i] == 'object' &&
                    this.listeners[event][i].filters != 'undefined' &&
                    Symple.match(this.listeners[event][i].filters, data[0])) {
                    this.listeners[event][i].fn.apply(this, data);
                    if (this.listeners[event][i].after != 'undefined') {
                        this.listeners[event][i].after.apply(this, data);   
                    }                 
                    return true;
                }
            }
        }
        return false;
    }
});


// -----------------------------------------------------------------------------
// Symple Roster
//
Symple.Roster = Symple.Manager.extend({
    init: function(client) {
        Symple.log('Symple Roster: Creating');
        this._super();
        this.client = client;
    },
    
    // Add a peer object to the roster
    add: function(peer) {
        Symple.log('Symple Roster: Adding: ', peer);
        if (!peer || !peer.id || !peer.user || !peer.group)
            throw 'Cannot add invalid peer'
        this._super(peer);
        this.client.doDispatch('addPeer', peer);
    },

    // Remove the peer matching an ID or address string: user@group/id
    remove: function(id) {
        id = Symple.parseIDFromAddress(id) || id;
        var peer = this._super(id);
        Symple.log('Symple Roster: Removing: ', id, peer);
        if (peer)
            this.client.doDispatch('removePeer', peer);
        return peer;
    },
    
    // Get the peer matching an ID or address string: user@group/id
    get: function(id) {
    
        // Handle IDs
        peer = this._super(id); // id = Symple.parseIDFromAddress(id) || id;
        if (peer)
            return peer;

        // Handle address strings
        return this.findOne(Symple.parseAddress(id));
    },
    
    update: function(data) {
        if (!data || !data.id)
            return;
        var peer = this.get(data.id);
        if (peer)
            for (var key in data)
                peer[key] = data[key];
        else
            this.add(data);
    }
        
    // Get the peer matching an address string: user@group/id
    //getForAddr: function(addr) {        
    //    var o = Symple.parseAddress(addr);
    //    if (o && o.id)
    //        return this.get(o.id);
    //    return null;
    //}
});


// -----------------------------------------------------------------------------
// Helpers
//
Symple.parseIDFromAddress = function(str) {
    var arr = str.split("/")
    if (arr.length == 2)
        return arr[1];
    return null;
};

Symple.parseAddress = function(str) {
    var addr = {}, base,
        arr = str.split("/")
        
    if (arr.length < 2) // no id
        base = str;        
    else { // has id
        addr.id = arr[1];   
        base = arr[0];   
    }
    
    arr = base.split("@")
    if (arr.length < 2) // group only
        addr.group = base;         
    else { // group and user
        addr.user = arr[0];
        addr.group  = arr[1];
    }
        
    return addr;
}

Symple.buildAddress = function(peer, defaultGroup) {
    return (peer.user ? (peer.user + '@') : '') + 
        (peer.group ? peer.group : defaultGroup) + '/' + 
        (peer.id ? peer.id : '');
}


// -----------------------------------------------------------------------------
// Message
//
Symple.Message = function(json) {
    if (typeof(json) == 'object')
        this.fromJSON(json);
    this.type = "message";
}

Symple.Message.prototype = {
    fromJSON: function(json) {
        for (var key in json)
            this[key] = json[key];
    },

    valid: function() {
        return this['id']
        && this['from'];
    }
};


// -----------------------------------------------------------------------------
// Command
//
Symple.Command = function(json) {
    if (typeof(json) == 'object')
        this.fromJSON(json);
    this.type = "command";
}

Symple.Command.prototype = {
    getData: function(name) {
        return this['data'] ? this['data'][name] : null;
    },

    params: function() {
        return this['node'].split(':');
    },
    
    param: function(n) {
        return this.params()[n-1];
    },

    matches: function(xuser) {
        xparams = xuser.split(':');

        // No match if x params are greater than ours.
        if (xparams.length > this.params().length)
            return false;

        for (var i = 0; i < xparams.length; i++) {

            // Wildcard * matches everything until next parameter.
            if (xparams[i] == "*")
                continue;
            if (xparams[i] != this.params()[i])
                return false;
        }

        return true;
    },

    fromJSON: function(json) {
        for (var key in json)
            this[key] = json[key];
    },

    valid: function() {
        return this['id']
        && this['from']
        && this['node'];
    }
};


// -----------------------------------------------------------------------------
// Presence
//
Symple.Presence = function(json) {
    if (typeof(json) == 'object')
        this.fromJSON(json);
    this.type = "presence";
}

Symple.Presence.prototype = {
    fromJSON: function(json) {
        for (var key in json)
            this[key] = json[key];
    },

    valid: function() {
        return this['id']
        && this['from'];
    }
};


// -----------------------------------------------------------------------------
// Event
//
Symple.Event = function(json) {
    if (typeof(json) == 'object')
        this.fromJSON(json);
    this.type = "event";
}

Symple.Event.prototype = {
    fromJSON: function(json) {
        for (var key in json)
            this[key] = json[key];
    },

    valid: function() {
        return this['id']
        && this['from']
        && this.name;
    }
};