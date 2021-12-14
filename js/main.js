var scope = {};

scope.recorderReady = false;
scope.recording = false;
scope.playing = false;
scope.myAudio = null;
scope.sourceMic = null;
scope.notchFilter = null;
scope.micGain = null;
scope.filter = null;
scope.finalAudio = null;
scope.outputGain = null;
scope.dynComp = null;
scope.visualizerInput = null;
scope.timeAnalyser = null;
scope.freqAnalyser = null;
scope.myRecorder = null; 
scope.recIndex = 0;  
scope.webSocket = null;
scope.ckEditor = null;

scope.insertText = function( text, consumeSpaces ) {
    var upperCaseChars = [ '\n', '.' ];
    var blockTags = [ 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'address', 'div', 'body' ];
    var emptyCharCodes = [ 9 /* horizontal tab */, 32 /* space */, 160 /* nbsp */ ];

    scope.ckEditor.fire( 'saveSnapshot' ); // se crea un snapshot para un futuro undo/redo
    scope.ckEditor.focus();
    var selection = scope.ckEditor.getSelection();
    var insertText = ( consumeSpaces ? '' : ' ' ) + text;

    var selectionRanges = selection ? selection.getRanges() : [];
    if ( selectionRanges.length ) {

        var bookmark = selectionRanges[0].createBookmark();
        if ( bookmark.startNode && bookmark.startNode.$ ) {
            
            bookmark = bookmark.startNode.$;
            var $container = jQuery( bookmark ).closest( blockTags.join( ',' ) );
            if ( $container.length ) {
                
                var containerHtml = $container[0].outerHTML;
                var containerTag = $container[0].tagName;
                var bookmarkHtml = bookmark.outerHTML;
                var bookmarkIndex = containerHtml.indexOf( bookmarkHtml );
                if ( bookmarkIndex >= 0 ) {

                    var previusText = '';
                    if ( bookmarkIndex ) {

                        var previusHtml = containerHtml.substring( 0, bookmarkIndex );

                        // se reemplazan los br por simbolos de parrafo ya que el br no funciona en innerText ( chrome 91 )
                        previusHtml = previusHtml.replace( /&para;/g, '&copy;' ); // por si ya hay un &para; en el html
                        previusHtml = previusHtml.replace( /<br>/g, '&para;' ); 

                        var $previusHtml = jQuery( previusHtml + '</' + containerTag + '>' );
                        if ( $previusHtml.length ) {
                            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText
                            previusText = $previusHtml[0].innerText.replace(/\u200B/g, ''); // elimina los &ZeroWidthSpace; que pudo generar el bookmark

                            // se reemplazan los simbolos de parrafo por saltos de linea ya que el br no funciona en innerText ( chrome v91 )
                            previusText = previusText.replace( /\u00B6/g, '\n' ); 
                        }
                    }

                    var previusTextLength = previusText.split('').length; // se debe usar split para obtener el número correcto (pueden haber caracteres unicode)
                    var lastCharacter = '';
                    for( var index = previusTextLength - 1; index >= 0; index-- ) {
                        if ( emptyCharCodes.indexOf( previusText.charCodeAt( index ) ) < 0 ) { // buscamos el primer caracter a la derecha que no este en el listado
                            lastCharacter = previusText.charAt( index );
                            break;
                        }
                    }

                    if ( lastCharacter === '' ) {
                        insertText = text.charAt(0).toLocaleUpperCase() + text.slice(1)
                    }
                    else if ( upperCaseChars.indexOf( lastCharacter ) >= 0 ) {
                        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trimEnd
                        if ( previusTextLength === previusText.trimEnd().length ) { // si no hay caracteres no imprimibles al final
                            insertText = ( consumeSpaces ? '' : ' ' ) + text.charAt(0).toLocaleUpperCase() + text.slice(1);
                        }
                        else {
                            insertText = text.charAt(0).toLocaleUpperCase() + text.slice(1);
                        }
                        
                    }
                    else {
                        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trimEnd
                        if ( previusTextLength === previusText.trimEnd().length ) { // si no hay caracteres no imprimibles al final
                            insertText = ( consumeSpaces ? '' : ' ' ) + text;
                        }
                        else {
                            insertText = text;
                        }
                    }
                }
            }

            scope.ckEditor.execCommand( 'undo' ); // por el .createBookmark()
        }
    }

    scope.ckEditor.insertText( insertText );

    //scope.ckEditor.setData( scope.ckEditor.getData().replace('&ZeroWidthSpace;', '') );

    /*
    var previousSibling = bookmark.previousSibling;
    while ( true ) {
        if ( previousSibling === null ) { // inicio del documento
            scope.ckEditor.insertText( text.charAt(0).toUpperCase() + text.slice(1) );
        }
        else if ( previousSibling.nodeName && previousSibling.nodeName.toUpperCase() === '#TEXT' ) {
            var previusText = previousSibling.nodeValue.replace(/\u200B/g, '').trimEnd();
    
            if (previusText.length === 0) {
                previousSibling = previousSibling.previousSibling;
                continue;
            }
            else if ( previusText.slice(-1) === '.' ) {
                scope.ckEditor.insertText( ' ' + text.charAt(0).toUpperCase() + text.slice(1) );
            }
            else {
                scope.ckEditor.insertText( ' ' + text );
            }
        }
        else if ( previousSibling.nodeName && previousSibling.nodeName.toUpperCase() === 'BR' ) {
            scope.ckEditor.insertText( text.charAt(0).toUpperCase() + text.slice(1) );
        }
        else {
            scope.ckEditor.insertText( ' ' + text );
        }

        break;
    }
    */
}

/*
var commands = {
    "type":"Configuration",
    "subtype":"Commands",
    "action":"AddCommands",
    "payload":{
        "context":"report",
        "commands":[
            {
                "name":"IniciarDictado",
                "words":"{Iniciar|empezar} dictado",
                "desc":"Activar el modo dictado"
            },
            {
                "name":"DetenerDictado",
                "words":"{Detener|parar} dictado",
                "desc":"Desactivar el modo dictado"
            },
            {
                "name":"AgregarFrase",
                "words":"Agregar frase",
                "desc":"Agregar una nueva frase"
            },
            {
                "name":"Deshacer",
                "words":"Deshacer",
                "desc":"Borrar último reconocimiento"
            },
            {
                "name":"Rehacer",
                "words":"Rehacer",
                "desc":"Insertar el último reconocimiento borrado"
            },
            {
                "name":"ActivarNegrita",
                "words":"Activar negrita",
                "desc":"Activar negrita"
            },
            {
                "name":"DesactivarNegrita",
                "words":"Desactivar negrita",
                "desc":"Desactivar negrita"
            },
            {
                "name":"ActivarCursiva",
                "words":"Activar cursiva",
                "desc":"Activar cursiva"
            },
            {
                "name":"DesactivarCursiva",
                "words":"Desactivar cursiva",
                "desc":"Desactivar cursiva"
            },
            {
                "name":"ActivarSubrayado",
                "words":"Activar subrayado",
                "desc":"Activar subrayado"
            },
            {
                "name":"DesactivarSubrayado",
                "words":"Desactivar subrayado",
                "desc":"Desactivar subrayado"
            },
            {
                "name":"GuardarInforme",
                "words":"{Guardar|cerrar} informe",
                "desc":"Guardar el informe"
            },
            {
                "name":"GuardarInformeFinalizado",
                "words":"{Guardar|cerrar} informe finalizado",
                "desc":"Guardar el informe como finalizado"
            },
            {
                "name":"GuardarInformePreliminar",
                "words":"{Guardar|cerrar} informe preliminar",
                "desc":"Guardar el informe como preliminar"
            },
            {
                "name":"Aparte",
                "words":"Aparte",
                "desc":"Insertar un salto de línea"
            },
            {
                "name":"NuevaLinea",
                "words":"Nueva línea",
                "desc":"Insertar un salto de línea"
            },
            {
                "name":"PuntoSeguido",
                "words":"Punto seguido",
                "desc":"Insertar punto(.)"
            },
            {
                "name":"PuntoAparte",
                "words":"punto [y] aparte",
                "desc":"Insertar punto(.) y un salto de linea"
            },
            {
                "name":"NuevoParrafo",
                "words":"Nuevo párrafo",
                "desc":"Insertar un nuevo párrafo"
            },
            {
                "name":"BorrarParrafo",
                "words":"Borrar párrafo",
                "desc":"Borra el ultimo parrafo dictado"
            },
            {
                "name":"ActivarMayusculas",
                "words":"Activar mayúsculas",
                "desc":"Activar el texto en mayúsculas"
            },
            {
                "name":"DesactivarMayusculas",
                "words":"Desactivar mayúsculas",
                "desc":"Desactivar el texto en mayúsculas"
            },
            {
                "name":"CampoSiguiente",
                "words":"Campo siguiente",
                "desc":"Reemplaza el campo editable siguiente con la palabra dictada",
                "withDictation":true
            },
            {
                "name":"CampoAnterior",
                "words":"Campo anterior",
                "desc":"Reemplaza el campo editable anterior con la palabra dictada",
                "withDictation":true
            },
            {
                "name":"CampoActual",
                "words":"Campo actual",
                "desc":"Reemplaza el ultimo campo activo con la palabra dictada",
                "withDictation":true
            },
            {
                "name":"PrimerCampo",
                "words":"primer campo",
                "desc":"Reemplaza el primer campo con la palabra dictada",
                "withDictation":true
            },
            {
                "name":"UltimoCampo",
                "words":"ultimo campo",
                "desc":"Reemplaza el último campo con la palabra dictada",
                "withDictation":true
            },
            {
                "name":"UbicarCampo",
                "words":"ubicar campo",
                "desc":"Posiciona el cursor en el campo indicado",
                "withDictation":true
            },
            {
                "name":"BorrarCampo",
                "words":"borrar campo",
                "desc":"Borra el valor del campo indicado",
                "withDictation":true
            },
            {
                "name":"MantenerCampo",
                "words":"mantener campo",
                "desc":"Fija el valor del campo indicado",
                "withDictation":true
            },         
            {
                "name":"QuePuedoDecir",
                "words":"que puedo decir"
            },
            {
                "name":"Punto",
                "words":"Punto",
                "desc":"Insertar punto(.)"
            },
            {
                "name":"Continuar",
                "words":"Continuar",
                "desc":"Selecciona el botón 'Continuar' para sobrescribir informe"
            },
            {
                "name":"selectsiguienteoracion",
                "words":"Seleccionar siguiente oración",
                "desc":"Selecciona siguiente oración"
            },
            {
                "name":"selectanteriororacion",
                "words":"Seleccionar anterior oración",
                "desc":"Selecciona anterior oración"
            },
            {
                "name":"iniciooracion",
                "words":"ir inicio oración",
                "desc":"Se posiciona al inicio de la oración"
            },
            {
                "name":"finoracion",
                "words":"ir fin oracion",
                "desc":"Se posiciona al final de la oración"
            },
            {
                "name":"inicioparrafo",
                "words":"ir inicio parrafo",
                "desc":"Se posiciona al inicio del párrafo"
            },
            {
                "name":"finaldeldocumento",
                "words":"ir final documento",
                "desc":"Se posiciona al final del documento"
            },
            {
                "name":"borrar",
                "words":"borrar seleccion"
            },
            {
                "name":"irsiguienteoracion",
                "words":"ir siguiente oracion"
            },
            {
                "name":"iranteriororacion",
                "words":"ir anterior oracion"
            },
            {
                "name":"anteriorparrafo",
                "words":"ir anterior parrafo"
            },
            {
                "name":"siguienteparrafo",
                "words":"ir siguiente parrafo"
            },
            {
                "name":"finparrafo",
                "words":"ir fin parrafo"
            },
            {
                "name":"transformaraminuscula",
                "words":"cambiar a minuscula"
            },
            {
                "name":"transformarenmayuscula",
                "words":"cambiar a mayúscula"
            },
            {
                "name":"capitalizar",
                "words":"cambiar a capitalizado"
            },
            {
                "name":"seleccionarpalabra",
                "words":"seleccionar palabra"
            },
            {
                "name":"seleccionarsiguiente",
                "words":"seleccionar siguiente"
            },
            {
                "name":"seleccionaranterior",
                "words":"seleccionar anterior"
            }

        ]
    }
};
*/

const editorEvents = ['Autotext', 'Recognition', 'Command'];

scope.initWebSocket = function(servidor, puerto, ssl, modo) {
    let hash = window.location.hash.substring(1).replace(/\/$/, '');
    let url  = ( ssl ? 'wss://' : 'ws://' ) + servidor + ':' + puerto + '/';
    
    if ( 'entrenamiento' == modo ) {
        url += 'training/';
    } 
    else if ( 'pronunciacion' == modo ) { 
        url += 'pronunciation/';
    }
    else {
        url += ( hash || 'report' ) + '/';
    }
	
    let webSocket = new WebSocket(url);

    //Open connection  handler.
    webSocket.onopen = function (evt) {
        scope.afterStartRecording(true, true);
    };

    //Message data handler.
    webSocket.onmessage = function (evt) {
        let message = JSON.parse(evt.data);
        if (!message) return;

        log(message);
        
        if (editorEvents.indexOf(message.type) >= 0) {
            if (scope.ckEditor) {
                if ( 'pronunciacion' == modo ) {
                    scope.ckEditor.insertText(message.text + '\n');
                }
                else {
                    if ('html' == message.format) {
                        scope.ckEditor.insertHtml( ' ' + message.text + ' ' );
                    } else {
                        scope.insertText( message.text, message.consumeSpaces ); // scope.ckEditor.insertText((message.consumeSpaces ? '' : ' ') + message.text);
                    }
                }
            }
        } else if ('Information' == message.type && 'SessionID' == message.subtype) {
            notify('success', 'Reconocimiento iniciado!');
        } else if ('Information' == message.type && 'Error' == message.subtype) {
            notify('warning', message.payload);
        } else if ('Training' == message.type) {
            if ('Recognized' == message.lastStatus) {
                $('#box-training').find('.text').css('color','#00C000');
                setTimeout(function() { scope.updateTraining(message); }, 1000);
            }
            else if ('NotRecognized' == message.lastStatus || 'Ignored' == message.lastStatus) {
                $('#box-training').find('.text').css('color','red');
                setTimeout(function() { scope.updateTraining(message); }, 1000);
            }
            else {
                scope.updateTraining(message);
            } 
        }
    };

    //Close event handler.
    webSocket.onclose = function (evt) {
        scope.stopRecording();
        console.log(evt);

        if (1000 == evt.code) {
            notify('info', 'Socket cerrado!');
        }
        else if (1006 == evt.code) {
            notify('danger', 'Socket cerrado por el navegador.');
        }
        else if (1011 == evt.code) {
            notify('danger', 'Socket cerrado. Error interno del Servidor. Motivo: ' + evt.reason );
        }
        else if ( evt.reason ) {
            notify('danger', 'Socket cerrado. Motivo: ' + evt.reason );
        }
        else {
            notify('danger', 'Socket cerrado!');
        }
    };

    //Error event handler.
    webSocket.onerror = function (evt) {
        scope.afterStartRecording(true, false);
        notify('danger', 'Error generado en el Socket.');
        console.error(evt);
    }

    scope.webSocket = webSocket;
}

scope.startRecording = function() {
    if (scope.recording || !scope.recorderReady)
        return;

    let vmspeech = 0;
    if ( '1' == $('#activar-vmspeech').val() ) {
        vmspeech = 1;

        let validate = $('#box-vmspeech form').validate();
        let valid = true;
        
        $('#box-vmspeech :input').not('[type=hidden]').each(function() {
            if ( !validate.element(this) && valid ) {
                $(this).focus();
                valid = false;
            }
        });

        if ( !valid ) {
            return;
        }
    }

    // para evitar multiples click
    scope.recorderReady = false;

    // Inhabilita todas las opciones
    scope.stopPlaying();
    $('.recorder-options').slideUp();
 
    if ( vmspeech ) {
        let servidor = $('#servidor').val();
        let puerto   = $('#puerto').val();
        let ssl      = '1' == $('#ssl').val();
        let modo     = $('#modo').val();

        scope.initWebSocket(servidor, puerto, ssl, modo);
    } else {
        scope.afterStartRecording();
    }				
};

scope.afterStartRecording = function(vmspeech, success) {
    if ( vmspeech ) {
        if ( !success ) {
            // Habilita todas las opciones
            $('.recorder-options').slideDown();
            scope.recorderReady = true;
            return;
        }
        
        let modo = $('#modo').val();
        
        if ( 'pronunciacion' != modo ) { 
            let user = $('#usuario').val();
            let password = $('#password').val();
            scope.webSocket.send(JSON.stringify({ 
                type: 'Initialization', 
                user: btoa(user),
                password: btoa(password),
                application: 'VMRecorder'
            }));
        }

        if ( 'dictado' == modo && window.commands ) {
            scope.webSocket.send(JSON.stringify(commands));
        }

        scope.myRecorder.onChunk(function(chunk) {
            scope.webSocket.send(chunk);
        });
    }

    scope.myRecorder.record({ 
        format: $('#format').val(),
        compression: $('#compression').val(),
        flacCompression: $('#flacCompression').val()
    });

    scope.recording = true;
    $('#recordButton').addClass('active');
    $('#box-training').find('.btn-start, .btn-adaptation').removeClass('disabled');
    scope.recorderReady = true;
}

scope.updateTraining = function(message) {
    $('#box-training').find('.default-text').addClass('d-none');
    $('#box-training').find('.text').removeClass('d-none').css('color','');

    if ( message.index ) {
        $('#box-training').find('.text').text(message.sentence);
        $('#box-training').find('.status').text('Frase ' + message.index + ' de ' + message.total);
    } else {
        $('#box-training').find('.text').html('<span style="font-weight: 500">Felicidades!</span> Ha completado el entrenamiento.');
        $('#box-training').find('.status').text('Entrenamiento finalizado');
    }
}

scope.stopRecording = function() {
    if (!scope.recording) {
        return;
    }

    scope.myRecorder.stop(function(s) {
        scope.myAudio.src = window.URL.createObjectURL(s);
    });
    // borra el callback en caso de haberse asociado en startRecording
    scope.myRecorder.onChunk(null);

    if ( scope.webSocket ) {
        scope.webSocket.close();
        scope.webSocket = null;
    }

    scope.recording = false;
    $('#recordButton').removeClass('active');

    // Habilita todas las opciones
    $('.recorder-options').slideDown();

    // Reinicia los valores del box-training
    $('#box-training').find('.text').addClass('d-none').text('');
    $('#box-training').find('.default-text').removeClass('d-none');
    $('#box-training').find('.btn').addClass('disabled');
    $('#box-training').find('.status').text('Entrenamiento no iniciado');
};

scope.startPlaying = function() {
    if (scope.playing || scope.recording) {
        return;
    }

    scope.myAudio.play();
    scope.playing = true;
    $('#playButton').addClass('active');
};

scope.stopPlaying = function() {
    if (!scope.playing) {
        return;
    }

    scope.myAudio.pause();
    scope.playing = false;
    $('#playButton').removeClass('active');
}; 

scope.sendCommand = function(type, subtype, command, payload) {
    if (!scope.recording || !scope.webSocket) {
        return;
    }

    scope.webSocket.send(JSON.stringify({ 
        type: type, 
        subtype: subtype,
        action: command,
        payload: payload || null
    }));
}

scope.forceDownload = function() {
    if (!scope.myAudio.src) {
        return;
    } 

    scope.recIndex++;
    scope.myRecorder.saveFile( 'myRecording' + ( (scope.recIndex < 10) ? '0' : '' ) + scope.recIndex );
};

scope.gotUserMedia = function(stream) {
    audioContext = new AudioContext();

    // initialize mic source
    scope.sourceMic = audioContext.createMediaStreamSource(stream);

    // create notch filter for 60 Hz
    /*
    scope.notchFilter = audioContext.createBiquadFilter();
	scope.notchFilter.frequency.value = 60.0;
	scope.notchFilter.type = 'notch';
    scope.notchFilter.Q.value = 10.0;
    */

    // for mic input mute
    scope.micGain = audioContext.createGain();

    // create a biquadfilter node for filtering
    scope.filter = audioContext.createBiquadFilter();

    // dummyNode
    scope.finalAudio = audioContext.createGain();

    // for speaker mute
    scope.outputGain = audioContext.createGain();				
    scope.outputGain.gain.value = 0;
    
    // limit output
    scope.dynComp = audioContext.createDynamicsCompressor();

    // final gain for visualizers
    scope.visualizerInput = audioContext.createGain();
    scope.visualizerInput.gain.value = 5;

    // create analyzer nodes for visualizations
	scope.timeAnalyser = audioContext.createAnalyser();
	scope.timeAnalyser.minDecibels = -90;
	scope.timeAnalyser.maxDecibels = -10;
    scope.timeAnalyser.smoothingTimeConstant = 0.85;
    scope.timeAnalyser.fftSize = 2048;

	scope.freqAnalyser = audioContext.createAnalyser();
	scope.freqAnalyser.minDecibels = -90;
	scope.freqAnalyser.maxDecibels = -10;
    scope.freqAnalyser.smoothingTimeConstant = 0.85;
    scope.freqAnalyser.fftSize = 256;
    
    /*
    scope.sourceMic.connect(scope.notchFilter);
    scope.notchFilter.connect(scope.micGain);
    */
    scope.sourceMic.connect(scope.micGain);

    scope.micGain.connect(scope.filter);
    scope.filter.connect(scope.finalAudio);

    scope.finalAudio.connect(scope.outputGain);
    scope.finalAudio.connect(scope.visualizerInput);

    scope.outputGain.connect(scope.dynComp);
    scope.dynComp.connect(audioContext.destination);

    // connect output to visualizers
    scope.visualizerInput.connect(scope.timeAnalyser);
    scope.visualizerInput.connect(scope.freqAnalyser);

    // initialize myRecorder (using recorder.js and recordworker.js)
    scope.myRecorder = new Recorder(scope.finalAudio, 1);
    scope.myRecorder.onReady(function() {
        scope.recorderReady = true;
    });

    visualize();

    // para cargar las opciones por defecto (se tiene que hacer en este punto ya que algunas opciones actuan sobre nodos)
    $('select').trigger('change'); 
};

scope.userMediaFailed = function(code) {
	throw 'grabbing microphone failed: ' + code;
};

$(function() {
    // map prefixed APIs
    if (!window.AudioContext) {
        window.AudioContext = window.webkitAudioContext;
    }

    if (!navigator.getUserMedia) {
        navigator.getUserMedia = (navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    }
        
    if (!navigator.cancelAnimationFrame) {
        navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
    }
        
    if (!navigator.requestAnimationFrame) {
        navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;
    }

    if (!window.AudioContext) {
        alert('Could not start recording audio:\n Web Audio is not supported by your browser!');	
        throw 'JavaScript execution environment (Browser) does not support AudioContext interface.';
    }

    if (!navigator.getUserMedia) {
        alert('Could not start recording audio:\n Web Audio is not supported by your browser!');
        throw 'JavaScript execution environment (Browser) does not support getUserMedia.';		
    }
        
    navigator.getUserMedia({
        "audio": {
            "mandatory": {
                "googEchoCancellation": "false",
                "googAutoGainControl": "false",
                "googNoiseSuppression": "false",
                "googHighpassFilter": "false"
            },
            "optional": []
        },
    }, scope.gotUserMedia, scope.userMediaFailed);

    scope.myAudio = $('#demoAudio').get(0);
    // para que restaure el estado del boton play al terminar la reproducción
    scope.myAudio.onended = function() {
        scope.stopPlaying();
    };

    scope.ckEditor = CKEDITOR.replace('editor');

    $('[data-toggle="tooltip"]').tooltip();

    $('form[data-validate=true]').find(':input').not('[type=hidden]').tooltipster({ 
        onlyOne: true, 
        position: 'top',
        theme: 'tooltipster-borderless'
    });

    $('form[data-validate=true]').each( function() {
        $(this).validate({
            errorClass: 'is-invalid',
            errorPlacement: function (error, element) {
                $(element).tooltipster('content', $(error).text());
                $(element).tooltipster('enable');
            },
            success: function (label, element) {
                $(element).tooltipster('disable');
            }
        });
    });
});

$(document).on('click', '#recordButton', function() {
    if (scope.recorderReady !== true) return;

    if(scope.recording === false) {
        scope.startRecording();       
    } else {
        scope.stopRecording();
    }
});

$(document).on('click', '#playButton', function() {
    if( scope.myAudio.src && scope.playing === false && scope.recording === false ) {
        scope.startPlaying();
    } else {
        scope.stopPlaying();
    }
});

$(document).on('click', '#saveButton', function() {
    scope.forceDownload();
});

$(document).on('click', '#micMute', function() {
    toggleGainState(this, scope.micGain);
});

$(document).on('click', '#speakerMute', function() {
    toggleGainState(this, scope.outputGain);
});

$(document).on('change', '#filter', function() {
    let $selected = $(this).find('option:selected');
    
    if ( $selected.val() === '' ) {
        scope.micGain.disconnect();
        scope.micGain.connect(scope.finalAudio);
    } else {
        scope.filter.type = $selected.val();
        scope.filter.frequency.value = $selected.data('frequency');
        scope.filter.Q.value = $selected.data('q');

        scope.micGain.disconnect();
        scope.micGain.connect(scope.filter);
    }
});

$(document).on('change', '#format', function() {
    if ( $(this).val() === 'flac' ) {
        $('.flac-options').slideDown();
    } else {
        $('.flac-options').slideUp();
    }
});

$(document).on('click', '.acf-switch-button', function() {
    let $input = $(this).siblings('.acf-switch-input');
    if ( '1' == $input.val() ) {
        $input.val('0');
        $(this).children('.acf-switch').removeClass('-on');
    } 
    else {
        $input.val('1');
        $(this).children('.acf-switch').addClass('-on');
    }

    $input.trigger('change');
});

$(document).on('change', '#activar-vmspeech', function() {
    if ( '1' == $(this).val() ) {
        if ( 'pronunciacion' == $('#modo').val() ) { 
            $('.vmspeech-options:not(.vmspeech-credentials)').slideDown();
        }
        else {
            $('.vmspeech-options').slideDown();
        }

        $('#format').attr('disabled','disabled').val('wave').trigger('change').selectpicker('refresh');
    } else {
        $('.vmspeech-options').slideUp();
        $('#format').removeAttr('disabled').selectpicker('refresh');
    }

    $('.vmspeech-options .is-invalid').removeClass('is-invalid').tooltipster('disable');
});

$(document).on('change', '#modo', function() {
    if ( 'entrenamiento' == $(this).val() ) {
        $('.vmspeech-credentials').slideDown();
        $('#box-editor').closest('.wrapper').addClass('d-none');
        $('#box-training').closest('.wrapper').removeClass('d-none');
    } 
    else {
        if ( 'pronunciacion' == $(this).val() ) { 
            $('.vmspeech-credentials').slideUp();
        }
        else {
            $('.vmspeech-credentials').slideDown();
        }

        $('#box-training').closest('.wrapper').addClass('d-none');
        $('#box-editor').closest('.wrapper').removeClass('d-none');
    }
});

$(document).on('click', '#box-training .btn-start', function() {
    $(this).siblings('.status').text('');
    scope.sendCommand('Control', 'Training', 'StartTraining');

    $(this).addClass('disabled');
    $(this).siblings('.btn-adaptation').addClass('disabled');
    $(this).siblings('.btn-pause').removeClass('disabled');
    $(this).siblings('.btn-stop').removeClass('disabled');
});

$(document).on('click', '#box-training .btn-pause', function() {
    if ( $(this).hasClass('active') ) {
        scope.sendCommand('Control', 'Training', 'ResumeTraining');
        $(this).removeClass('active');
    } else {
        scope.sendCommand('Control', 'Training', 'PauseTraining');
        $(this).addClass('active');
    }
});

$(document).on('click', '#box-training .btn-stop', function() {
    scope.sendCommand('Control', 'Training', 'StopTraining');

    $(this).siblings('.btn-start, .btn-adaptation').removeClass('disabled');
    $(this).siblings('.btn-pause').addClass('disabled').removeClass('active');
    $(this).addClass('disabled');
});

$(document).on('click', '#adaptationModal .btn-confirm', function() {
    let $modal = $(this).closest('.modal');
    let data   = $modal.find('form .adaptation-data').val().replace('\n', ' ');

    scope.sendCommand('Control', 'Training', 'Adaptation', data);
    $modal.modal('hide');
});

$(document).on('shown.bs.modal', '#adaptationModal', function () {
    $(this).find('form :input:first').focus();
});

$(document).on('hidden.bs.modal', '#adaptationModal', function () {
    $(this).find('form')[0].reset();
    $(this).find('form .is-invalid').removeClass('is-invalid').tooltipster('disable');
});

// active

function toggleGainState (element, node){
    if (node.gain.value === 0) {
        node.gain.value = 1;
        $(element).removeClass('active');
    } else {
        node.gain.value = 0;
        $(element).addClass('active');
    }
};

function notify(type, message, title, width) {
    width = width || 'auto';

    $.notify({
        title: title,
        message: message
    },{
        type: type,
        newestOnTop: true,
        allowDismiss: true,
        showProgressBar: true,
        placement: {
            from: 'bottom',
            align: 'center'
        }
    });
}

function log(message) {
    if (message instanceof Object) {
        $tbody = $('#box-log tbody').empty();

        for (let prop in message) {
            // skip loop if the property is from prototype
            if(!message.hasOwnProperty(prop)) continue;
    
            $tbody.append(
                $('<tr/>').append([
                    $('<th/>', { 'scope': 'row' } ).text(prop + ':'),
                    $('<td/>').text(message[prop])
                ])
            );
        }
    } 
}

//=============================
// visualize stream
//=============================

function visualize() {
    // set up canvas contexts for visualizations
	var freqCanvas = document.getElementById('frequencyCanvas');
	var freqCanvasContext = freqCanvas.getContext('2d');
	var timeCanvas = document.getElementById('timeCanvas');
    var timeCanvasContext = timeCanvas.getContext('2d');
    freqCanvas.setAttribute('width', freqCanvas.parentNode.clientWidth);
	timeCanvas.setAttribute('width', timeCanvas.parentNode.clientWidth);
    
    var FREQWIDTH = freqCanvas.width;
    var FREQHEIGHT = freqCanvas.height;
    var TIMEWIDTH = timeCanvas.width;
    var TIMEHEIGHT = timeCanvas.height;

    // time visualization prep
    var timeBufferLength = scope.timeAnalyser.fftSize;
    var timeDataArray = new Uint8Array(timeBufferLength);

    // frequency visualization prep
    var freqBufferLength = scope.freqAnalyser.frequencyBinCount;
    var freqDataArray = new Uint8Array(freqBufferLength);

    timeCanvasContext.clearRect(0, 0, TIMEWIDTH, TIMEHEIGHT);
    freqCanvasContext.clearRect(0, 0, FREQWIDTH, FREQHEIGHT);

    // create time based visualization
    var drawTime = function() {
        requestAnimationFrame(drawTime);
        scope.timeAnalyser.getByteTimeDomainData(timeDataArray);

        timeCanvasContext.fillStyle = 'rgb(0, 0, 0)';
        timeCanvasContext.fillRect(0, 0, TIMEWIDTH, TIMEHEIGHT);

        timeCanvasContext.lineWidth = 2;
        timeCanvasContext.strokeStyle = 'rgb(179, 252, 254)';

        timeCanvasContext.beginPath();

        var sliceWidth = TIMEWIDTH * 1.0 / timeBufferLength;
        var x = 0;

        for(var i = 0; i < timeBufferLength; i++) {

            var v = timeDataArray[i] / 128.0;
            var y = v * TIMEHEIGHT / 2;

            if (i === 0) {
                timeCanvasContext.moveTo(x, y);
            } else {
                timeCanvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        timeCanvasContext.lineTo(timeCanvas.width, timeCanvas.height / 2);
        timeCanvasContext.stroke();
    };

    // create frequency based visualization
    var drawFreq = function() {
        requestAnimationFrame(drawFreq);
        scope.freqAnalyser.getByteFrequencyData(freqDataArray);

        freqCanvasContext.fillStyle = 'rgb(0, 0, 0)';
        freqCanvasContext.fillRect(0, 0, FREQWIDTH, FREQHEIGHT);

        var barWidth = (FREQWIDTH / freqBufferLength);
        var barHeight;
        var x = 0;

        for(var i = 0; i < freqBufferLength; i++) {
            barHeight = 1.5 * freqDataArray[i];

            // blue bars for low signal, red for high
            freqCanvasContext.fillStyle = 'rgb(' + (179 + barHeight / 1.5) + ', ' + (252 - barHeight / 1.5) + ', 254)';
            freqCanvasContext.fillRect(x, FREQHEIGHT - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1;
        }
    };

    drawTime();
    drawFreq();
};