// -----------------------------------------------------------------------------
// WebRTC Engine
//
window.RTCPeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCSessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
window.RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
navigator.getUserMedia = navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.URL = window.webkitURL || window.URL;

   
Symple.Media.registerEngine({
    id: 'WebRTC',
    name: 'WebRTC Player',
    formats: 'VP8, Opus', 
    preference: 100,
    support: (function() {
        return typeof RTCPeerConnection != "undefined";
    })()
});


Symple.Player.Engine.WebRTC = Symple.Player.Engine.extend({
    init: function(player) {
        Symple.log("SympleWebRTC: Init");
        this._super(player);
        
        this.rtcConfig = player.options.rtcConfig || {
          iceServers: [
            { url: "stun:stun.l.google.com:19302" }
          ]
        }
        this.rtcOptions = player.options.rtcOptions || {
            optional: [
                {DtlsSrtpKeyAgreement: true} // FF <=> Chrome interop
            ]
        }
        this.mediaConstraints = player.options.mediaConstraints || {}
        //this.mediaConstraints = player.options.mediaConstraints || {
        //  'mandatory': {
        //    'OfferToReceiveAudio':true, 
        //    'OfferToReceiveVideo':true
        //  }
        //};
    },
    
    setup: function() {
        Symple.log("SympleWebRTC: Setup");
        
        this._createPeerConnection(); 
        
        // Note: Absolutely position video element so it scales to  
        // the parent element size. Need to test in other browsers.        
        
        if (typeof(this.video) == 'undefined') {
            Symple.log("SympleWebRTC: Setup: Peer video");
            this.video = $('<video autoplay></video>')
            this.player.screen.prepend(this.video);    
        }
        
        //this.video = $('<video width="100%" height="100%" style="position:absolute;left:0;top:0;"></video>'); // Chrome
        //this.selfVideo = typeof(this.selfVideo) == 'undefined' ? $('<video></video>') : this.selfVideo;
        //this.video = typeof(this.video) == 'undefined' ? $('<video></video>') : this.video; // style="position:absolute;left:0;top:0;"  width="100%" height="100%"  style="max-width:100%;height:auto;"
    },
      
    destroy: function() {   
        Symple.log("SympleWebRTC: Destroy");
        this.sendLocalSDP = null;
        this.sendLocalCandidate = null;
        
        if (this.video) {
            this.video[0].src = '';
            this.video[0] = null;
            this.video = null;
            // Anything else required for video cleanup?
        }
                
        if (this.pc) {
            this.pc.close();
            this.pc = null;
            // Anything else required for peer connection cleanup?
        }        
    },

    play: function(params) {        
        Symple.log("SympleWebRTC: Play", params);
        
        // The 'playing' state will be set when candidates
        // gathering is complete.
        // TODO: Get state events from the video element 
        // to shift from local loading to playing state.       
        
        if (params && params.localMedia) {
          
            // Get the local stream, show it in the local video element and send it
            var self = this;  
            navigator.getUserMedia({ audio: !params.disableAudio, video: !params.disableVideo }, 
            
                // successCallback
                function (localStream) {              
                    
                    //self._createPeerConnection(); 
                        
                    // Play the local stream
                    self.video[0].src = URL.createObjectURL(localStream);
                    self.pc.addStream(localStream);

                    //if (params.caller)
                        self.pc.createOffer(
                            function(desc) { self._onLocalSDP(desc); });
                    //else
                    //    self.pc.createAnswer(
                    //        function(desc) { self._onLocalSDP(desc); },
                    //        function() { // error
                    //            self.setError("Cannot create local SDP answer");
                    //        },
                    //        null //this.mediaConstraints;
                    //    )

                    //function gotDescription(desc) {
                    //    pc.setLocalDescription(desc);
                    //    signalingChannel.send(JSON.stringify({ "sdp": desc }));
                    //}
                },

                // errorCallback
                function(err) {
                    self.setError("getUserMedia() Failed: " + err);
                });
        }
    },

    stop: function() {
        
        if (this.video) {
            this.video[0].src = '';
            // Do not nullify
        }
                
        // TODO: Close peer connection?
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
            
        this.setState('stopped');
    },
    
    mute: function(flag) {
        // Mute unless explicit false given
        flag = flag === false ? false : true;
        Symple.log("SympleWebRTC: Mute:", flag);
        
        if (this.video) {
            this.video.prop('muted', flag); //mute
        } 
    },

    // Initiates the player with local media capture
    //startLocalMedia: function(params) {        
        //Symple.log("SympleWebRTC: Play", params);
        
        // The 'playing' state will be set when candidates
        // gathering is complete.
        // TODO: Get state events from the video element 
        // to shift from local loading to playing state.        
    //},
    
    //
    // Called when local SDP is ready to be sent to the peer.
    sendLocalSDP: new Function,
    
    //
    // Called when a local candidate is ready to be sent to the peer.    
    sendLocalCandidate: new Function,    
    
    //
    // Called when remote SDP is received from the peer.
    onRemoteSDP: function(desc) {   
        Symple.log('SympleWebRTC: Recieve remote SDP:', desc)        
        if (!desc || !desc.type || !desc.sdp)
            throw "Invalid SDP data"
                    
        //if (desc.type != "offer")
        //    throw "Only SDP offers are supported"
        
        var self = this;             
        this.pc.setRemoteDescription(new RTCSessionDescription(desc), 
            function() {
                Symple.log('SympleWebRTC: SDP success');
                //alert('success')
            }, 
            function(message) {
                console.error('SympleWebRTC: SDP error:', message);
                self.setError("Cannot parse remote SDP offer");
            }
        );   
            
        if (desc.type == "offer") {
            this.pc.createAnswer(
                function(answer) { // success
                    self._onLocalSDP(answer);                    
                    //alert('answer')
                },
                function() { // error
                    self.setError("Cannot create local SDP answer");
                },
                null //this.mediaConstraints
            );
        }
    },    
    
    //
    // Called when remote candidate is received from the peer.
    onRemoteCandidate: function(candidate) { 
        //Symple.log("SympleWebRTC: Recieve remote candiate ", candidate);
        if (!this.pc)
            throw 'The peer connection is not initialized' // call onRemoteSDP first
            
        this.pc.addIceCandidate(new RTCIceCandidate({
            //sdpMid: candidate.sdpMid, 
            sdpMLineIndex: candidate.sdpMLineIndex, 
            candidate: candidate.candidate
        }));      
    },   
    
    
    //
    // Private methods
    //

    //
    // Called when local SDP is received from the peer.
    _onLocalSDP: function(desc) {       
        try {
            this.pc.setLocalDescription(desc);
            this.sendLocalSDP(desc);
        } 
        catch (e) {
            Symple.log("Failed to send local SDP:", e);            
        }
    }, 
    
    _createPeerConnection: function() {          
        if (this.pc)
            throw 'The peer connection is already initialized'
              
        Symple.log("SympleWebRTC: Creating peer connection: ", this.rtcConfig);
                
        var self = this;
        this.pc = new RTCPeerConnection(this.rtcConfig, this.rtcOptions);
        this.pc.onicecandidate = function(event) {
            if (event.candidate) {
                //Symple.log("SympleWebRTC: Local candidate gathered:", event.candidate);                
                self.sendLocalCandidate(event.candidate); 
            } 
            else {
                Symple.log("SympleWebRTC: Local candidate gathering complete");
            }
        };
        this.pc.onaddstream = function(event) {         
            Symple.log("SympleWebRTC: Remote stream added:", URL.createObjectURL(event.stream));
                
            // Set the state to playing once candidates have completed gathering.
            // This is the best we can do until ICE onstatechange is implemented.
            self.setState('playing');
                
            self.video[0].src = URL.createObjectURL(event.stream);
            self.video[0].play(); 
        };
        this.pc.onremovestream = function(event) { 
            Symple.log("SympleWebRTC: Remote stream removed:", event);
            self.video[0].stop(); 
        };
        
        // Note: The following state events are completely unreliable.
        // Hopefully when the spec is complete this will change, but
        // until then we need to "guess" the state.
        //this.pc.onconnecting = function(event) { Symple.log("SympleWebRTC: onconnecting:", event); };
        //this.pc.onopen = function(event) { Symple.log("SympleWebRTC: onopen:", event); };
        //this.pc.onicechange = function(event) { Symple.log("SympleWebRTC: onicechange :", event); };
        //this.pc.onstatechange = function(event) { Symple.log("SympleWebRTC: onstatechange :", event); };
        
        Symple.log("SympleWebRTC: Setupd RTCPeerConnnection with config: " + JSON.stringify(this.rtcConfig));
    }
});


//
// Helpers

Symple.Media.iceCandidateType = function(candidateSDP) {
  if (candidateSDP.indexOf("typ relay") != -1)
    return "turn";
  if (candidateSDP.indexOf("typ srflx") != -1)
    return "stun";
  if (candidateSDP.indexOf("typ host") != -1)
    return "host";
  return "unknown";
}
