function createPlayer($scope, origin, selector) {
    var player = new Symple.Player({
        element: selector,
        engine: 'WebRTC', 
        rtcConfig: WEBRTC_CONFIG,
        mediaConstraints: {
          'mandatory': {
            'OfferToReceiveAudio':true, 
            'OfferToReceiveVideo':true
          }
        },
        onStateChange:  function(player, state) {
            player.displayStatus(state);
        }
    });
    player.setup();        
    player.engine.sendLocalSDP = function(desc) { 
        $scope.client.send({
            name: 'call:ice:sdp',
            to: $scope.remoteVideoPeer,
            origin: origin,
            type: 'event',
            sdp: desc
        })
    }
    player.engine.sendLocalCandidate = function(cand) { 
        $scope.client.send({
            name: 'call:ice:candidate',
            to: $scope.remoteVideoPeer,
            origin: origin,
            type: 'event',
            candidate: cand
        })
    }    
    return player;
}

function getHandleFromURL() {
    return location.search.split('handle=')[1] ? location.search.split('handle=')[1] : '';
}

function assertGetUserMedia() {
    if (navigator.getUserMedia || navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia || navigator.msGetUserMedia) {
        return true;
    }
    else {
        alert('getUserMedia() is not supported in your browser. Please upgrade to the latest Chrome or Firefox.');
        return false;
    }
}