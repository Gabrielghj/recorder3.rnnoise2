(function(window){
    suppressNoise = true;
    var inputBuffer = [];
    var outputBuffer = [];
    let frameBuffer = [];
    let buffers = [];
    var output = []
    var WORKER_PATH = 'js/encoder/encoder.js';

    var Recorder = function( source, pChannels, pBufferLen ) {
        pChannels = pChannels || 1;
        pBufferLen = pBufferLen || 4096;

        this.context = source.context;

        initializeNoiseSuppressionModule();
        
        if( !this.context.createScriptProcessor ) {
            this.node = this.context.createJavaScriptNode(pBufferLen, pChannels, 2);
        } else {
            this.node = this.context.createScriptProcessor(pBufferLen, pChannels, 2);
        }
   
        let worker = new Worker(WORKER_PATH),
            channels = pChannels,
            sampleRate = this.context.sampleRate,
            ready = false, 
            readyCallback, 
            recording = false,
            notifyChunks = 0,
            chunkCallback,
            dataCallback;

        this.node.onaudioprocess = function(e){
            if (!recording) return;

            //let buffers = [];
            for (let i = 0; i < e.inputBuffer.numberOfChannels; i++) {
                var input = e.inputBuffer.getChannelData(i);


                for (let i = 0; i < pBufferLen; i++) {
                    inputBuffer.push(input[i]);
                  }
                      
                  while (inputBuffer.length >= 480) {
                    for (let i = 0; i < 480; i++) {
                      frameBuffer[i] = inputBuffer.shift();
                    }
                    // Supresión de ruido
                    if (suppressNoise) {      // opción para anular rnnoise
                      removeNoise(frameBuffer);
                    }
                    for (let i = 0; i < 480; i++) {
                      outputBuffer.push(frameBuffer[i]);
                    }
                  }
                  // No hay suficientes datos, salir antes, 
                  if (outputBuffer.length < pBufferLen) {
                    return;
                  }
                  // Vaciar el búfer de salida.
                  for (let i = 0; i < pBufferLen; i++) {
                       output[i] = outputBuffer.shift();
                  }
      
                  buffers[i] = new Float32Array(output);  


            }
	  
            worker.postMessage({
                command: 'encode',
                buffers: buffers
            });
        }

        this.isReady = function() {
            return ready;
        }

        this.isRecording = function() {
            return recording;
        }

        this.onReady = function( cb ) {
            readyCallback = cb;
            if ( ready && readyCallback ) {
                readyCallback();
            }
        };

        this.onChunk = function ( cb, exclusive ) {
            if ( recording ) throw 'Recorder is Recording';

            chunkCallback = cb;
            
            if ( chunkCallback ) {
                notifyChunks = (exclusive ? 2 : 1);
            } else {
                notifyChunks = 0;
            }

            // 0: NO_NOTIFY_CHUNKS
            // 1: NOTIFY_CHUNKS
            // 2: NOTIFY_CHUNKS_ONLY
        }

        this.record = function( config ) {
            if ( !ready ) throw 'Recorder is not Ready';
            if ( recording ) throw 'Recorder is already Recording';

            config = config || {};
            config.format = config.format || 'wave';
            config.compression = config.compression || '';
            config.flacCompresion = config.flacCompresion || 0;

            console.log('start recording');

            console.log('initializing encoder with:');
            console.log(' format          = ' + config.format);
            console.log(' compression     = ' + config.compression);
            console.log(' flacCompresion  = ' + ( config.format == 'flac' ? config.flacCompresion : 'N/A' ));
            console.log(' sample rate     = ' + sampleRate);
            console.log(' channels        = ' + channels);
    
            worker.postMessage({
                command: 'init',
                config: {
                    format: config.format,
                    sampleRate: sampleRate, 
                    channels: channels, 
                    compression: config.compression,
                    flacCompresion: config.flacCompresion,
                    notifyChunks: notifyChunks
                }
            });

            recording = true;
        }

        this.stop = function( cb ) {
            if ( !recording ) throw 'Recorder is not Recording';

            console.log('stop recording');

            recording = false;
            dataCallback = cb;

            worker.postMessage({ 
                command: 'finish' 
            });

            if ( dataCallback ) {
                worker.postMessage({ 
                    command: 'export' 
                });
            }
        }

        this.getData = function(cb) {
            if ( recording ) throw 'Recorder is Recording';
            if ( !cb ) throw 'callback is Required';

            dataCallback = cb;
            worker.postMessage({ 
                command: 'export'
            });
        }

        this.saveFile = function(fileName) {
            if ( recording ) throw 'Recorder is Recording';
            if ( !fileName ) throw 'fileName is Required';

            dataCallback = doSaveFile;
            worker.postMessage({ 
                command: 'export',
                fileName: fileName
            });
        }

        this.clear = function() {
            if ( recording ) throw 'Recorder is Recording';

            worker.postMessage({ 
                command: 'clear' 
            });
        }

        worker.onmessage = function(e){
            switch (e.data.command) {
                case 'ready':
                    ready = true;
                    if ( readyCallback ) readyCallback();
                    break;

                case 'chunk':
                    if ( chunkCallback ) chunkCallback(e.data.chunk);
                    break;

                case 'data':
                    if ( dataCallback ) dataCallback(e.data.blob, e.data.fileName);                    
                    break;
                    
            }
        }

        source.connect(this.node);
        this.node.connect(this.context.destination);
    };
    function initializeNoiseSuppressionModule() {
        //let Module = null;
        //if (Module) {
        //  return;
        //}
        Module = {
          noExitRuntime: true,
          noInitialRun: true,
          preInit: [],
          preRun: [],
          postRun: [function () {
            console.log(`Loaded Javascript Module OK`);
          }],
          memoryInitializerPrefixURL: "bin/",
          arguments: ['input.ivf', 'output.raw']
        };
        NoiseModule(Module);
        Module.st = Module._rnnoise_create();
        Module.ptr = Module._malloc(480 * 4); 
      }


    function removeNoise(buffer) {
        let ptr = Module.ptr;
        let st = Module.st;
        for (let i = 0; i < 480; i++) {
          Module.HEAPF32[(ptr >> 2) + i] = buffer[i] * 8192;
        }
        Module._rnnoise_process_frame(st, ptr, ptr);
        for (let i = 0; i < 480; i++) {
          buffer[i] = Module.HEAPF32[(ptr >> 2) + i] / 8192;
        }
      }

    function doSaveFile(blob, fileName) {
        console.log('saveFile ' + blob + ' as ' + fileName);

        if ( navigator.msSaveBlob ) {
            navigator.msSaveBlob(blob, fileName);
        } else {
            let url = (window.URL || window.webkitURL).createObjectURL(blob);
            let link = window.document.createElement('a');
            link.href = url;
            link.download = fileName || 'output.wav';

            //NOTE: FireFox requires a MouseEvent (in Chrome a simple Event would do the trick)
            let click = document.createEvent('MouseEvent');
            click.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            link.dispatchEvent(click);
        }
    }

    window.Recorder = Recorder;

})(window);
