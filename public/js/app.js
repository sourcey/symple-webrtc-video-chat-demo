//
// AngilarJS controller     

function SympleChat($scope) {
    $scope.client;
    $scope.localPlayer;
    $scope.remotePlayer;   
    $scope.remoteVideoPeer;    
    $scope.handle;
    $scope.directUser;    
    $scope.peers = [];  
    $scope.messages = []; 
    $scope.messageText = ""; 

    $(document).ready(function() {            
        
        //
        // Client

        $scope.client = new Symple.Client({
            url: 'http://localhost:4500',
            peer: {
                //user: 'myusername',
                //name: 'My Name',
                group: 'public' 
            }});    
            
        $scope.client.on('announce', function(peer) {
            //console.log('announce:', peer)
        });

        $scope.client.on('presence', function(p) {
            //console.log('presence:', p)
        });

        $scope.client.on('message', function(m) {
            //console.log('message:', m)   
            
            // Normal Message
            if (!m.direct || m.direct == $scope.handle) {
                $scope.messages.push({
                    user: m.from.user,
                    data: m.data,
                    direct: m.direct, 
                    time: Symple.formatTime(new Date)
                });
                $scope.$apply();
            }
            else
                console.log('dropping message:', m, m.direct)
        });
        
        $scope.client.on('command', function(c) {
            //console.log('command:', c)
                            
            if (c.node == 'call:init') {
            
                if (!c.status) {
                    // Show a dialog to the user asking if they want to accept the call
                    var e = $('#incoming-call-modal')
                    e.find('.caller').text('@' + c.from.user)
                    e.find('.accept').unbind('click').click(function() {
                      c.status = 200;
                      $scope.remoteVideoPeer = c.from;
                      $scope.client.respond(c);
                      $scope.$apply();
                      e.modal('hide')      
                    })
                    e.find('.reject').unbind('click').click(function() {
                      c.status = 500;
                      $scope.client.respond(c);
                      e.modal('hide')  
                    })
                    e.modal('show')   
                }    
                else if (c.status == 200) {      
                    // Handle call accepted     
                    $scope.remoteVideoPeer = c.from;
                    $scope.startLocalVideo();      
                    $scope.$apply();
                }  
                else if (c.status == 500) {  
                    // Handle call rejected
                                            
                } 
                else {  
                    alert('Unknown response status')
                }             
            }
        });

        $scope.client.on('event', function(e) {  
            //console.log('event:', e)     
            
            // Only handle events from the remoteVideoPeer
            if (!$scope.remoteVideoPeer || $scope.remoteVideoPeer.id != e.from.id) {                        
                console.log('mismatch event:', e.from, $scope.remoteVideoPeer)  
                return
            }
                            
            // ICE SDP
            if (e.name == 'call:ice:sdp') {                    
                if (e.sdp.type == 'offer') {  
                     
                    // Create the remote player on offer
                    if (!$scope.remotePlayer) {
                        $scope.remotePlayer = createPlayer($scope, 'answerer', '#video .remote-video');
                        $scope.remotePlayer.play();
                    }    
                    $scope.remotePlayer.engine.onRemoteSDP(e.sdp);             
                }
                if (e.sdp.type == 'answer') { 
                    $scope.localPlayer.engine.onRemoteSDP(e.sdp);                   
                }
            }
            
            // ICE Candidate
            else if (e.name == 'call:ice:candidate') {                                      
                if (e.origin == 'answerer')
                    $scope.localPlayer.engine.onRemoteCandidate(e.candidate);   
                else if (e.origin == 'caller') 
                    $scope.remotePlayer.engine.onRemoteCandidate(e.candidate);   
                else 
                    alert('Unknown candidate origin');
            } 
            
            else {
                alert('Unknown event: ' + e.name);                
            }
        });

        $scope.client.on('disconnect', function() {
            console.log('disconnected')
            alert('Disconnected from the server')
        });

        $scope.client.on('error', function(error, message) {
            console.log('Connection error:', error, message)
            alert('Cannot connect to the server.')
        });

        $scope.client.on('addPeer', function(peer) {
            console.log('add peer:', peer)            
            $scope.peers.push(peer);
            $scope.$apply();
        });

        $scope.client.on('removePeer', function(peer) {
            console.log('remove peer:', peer)
            for (var i =0; i < $scope.peers.length; i++) {
                if ($scope.peers[i].id === peer.id) {
                    $scope.peers.splice(i,1);
                    $scope.$apply();
                    break;
                }
            }
        });
                
        // Init handle from URL if available
        var handle = getHandleFromURL();
        if (handle && handle.length) {     
            $scope.handle = handle;
            $scope.login();        
        }
    });    
           
    
    //
    // Messaging 
    $scope.setMessageTarget = function(user) {
        console.log('setMessageTarget', user)
        $scope.directUser = user ? user : ''
        $('.direct-user').text('@' + $scope.directUser)
        //alert(a)
    } 
        
    $scope.sendMessage = function() {            
        console.log('sendMessage', $scope.messageText);
        $scope.client.sendMessage({
            data: $scope.messageText, 
            direct: $scope.directUser
        });
        $scope.messages.push({
           direct: $scope.directUser,
           user: $scope.handle,
           data: $scope.messageText,
           time: Symple.formatTime(new Date)
        });
        $scope.messageText = "";          
    };
            
    // Login
    $scope.login = function() {
        $scope.client.options.peer.user = $scope.handle;
        $scope.client.connect();         
    }
        
         
    //       
    // Video
    
    $scope.startVideoCall = function(user) {
        if (assertGetUserMedia()) {            
            console.log('startVideoCall', user)
            if (user == $scope.handle) {
                alert('Cannot video chat with yourself. Please open a new browser window and login with a different handle.');            
                return;
            }   
            
            $scope.client.sendCommand({
                node: 'call:init',
                to: { user: user }                
            })          
        }         
    }
           
    $scope.startLocalVideo = function() {
        if (assertGetUserMedia()) {
        
            // Init local video player
            $scope.localPlayer = createPlayer($scope, 'caller', '#video .local-video');
            $scope.localPlayer.play({ localMedia: true, disableAudio: true });
            
            // TODO: Set false on session end or Symple error
            $scope.localVideoPlaying = true;
        } 
    } 
        
    
    //
    // Helpers
    
    $scope.isLoggedIn = function() {
        return $scope.handle != null && $scope.client.online();
    }
    
    $scope.getMessageClass = function(m) {
        if (m.direct)
            return 'list-group-item-warning';
        return '';
    }
}