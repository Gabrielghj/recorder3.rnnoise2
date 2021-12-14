importScripts('libflac4-1.3.2.min.js');

const MAX_UINT32 = 4294967295;

var _format = null,
	_channels = null,
	_buffers = [],
	_buffersBytes = 0,
	_flacEncoder = null,
	_notifyChunks = false,
	_sampleRateCompression;

self.onmessage = function(e) {
	switch(e.data.command) {
		case 'init':
			_format   = ( e.data.config.format === 'flac' ? 'flac' : 'wave' );
			_channels = ( e.data.config.channels === 2 ? 2 : 1 );
			_notifyChunks = e.data.config.notifyChunks || 0;
			let sampleRate = e.data.config.sampleRate;
			let compression = e.data.config.compression || '';
			let flacCompresion = e.data.config.flacCompresion || 0;

			setSampleRateCompression(sampleRate, compression);
			clear();

			sampleRate /= _sampleRateCompression;

			if (_format === 'flac') {
				initFlac(_channels, sampleRate, flacCompresion);
			} else {
				initWave(_channels, sampleRate);
			}
			break;

		case 'encode':
			if (_format === 'flac') {
				encodeFlac(e.data.buffers);
			} else {
				encodeWave(e.data.buffers);
			}	
			break;

		case 'finish':	
			if (_format === 'flac') {
				finishFlac();
			} else {
				finishWave();
			}	
			break;

		case 'export':
			let blob = getData( _format === 'flac' ? 'audio/flac' : 'audio/wav' );

			if (e.data.fileName) {
				e.data.fileName += ( _format === 'flac' ? '.flac' : '.wav' );
			}

			self.postMessage({
				command: 'data', 
				fileName: e.data.fileName,
				blob: blob
			});

			break;

		case 'clear':
			clear();
			break;
	}
};

function setSampleRateCompression(sampleRate, compression) {
	_sampleRateCompression = 1;

	if ( compression === 'high' ) {
		switch ( sampleRate ) {
			case 48000:
			case 44100:
				_sampleRateCompression = 4;
				break;
			case 32000:
			case 24000:   
			case 22050:
				_sampleRateCompression = 2;
				break;
		}
	}

	if ( compression === 'medium' ) {
		switch ( sampleRate ) {
			case 48000:
			case 44100:
			case 32000:
				_sampleRateCompression = 2;
				break;
		}
	}
}

function initFlac(channels, sampleRate, flacCompresion) {
	if ( !Flac.isReady() ) {
		throw 'Flac was not initialized: could not encode data!';	
	}

	_flacEncoder = Flac.init_libflac_encoder(sampleRate, channels, 16, flacCompresion, 0);

	if ( _flacEncoder == 0 ) {
		throw 'Error initializing the encoder.';
	}

	Flac.init_encoder_stream(_flacEncoder, writeCallback, metadataCallback);
}

function writeCallback(data) {
	// 0: NO_NOTIFY_CHUNKS
	// 1: NOTIFY_CHUNKS
	// 2: NOTIFY_CHUNKS_ONLY

	// NOTIFY_CHUNKS_ONLY
	if ( _notifyChunks !== 2 ) {
		_buffers.push(data);
		_buffersBytes += data.byteLength;
	}

	// NO_NOTIFY_CHUNKS
	if ( _notifyChunks !== 0 ) {
		self.postMessage({
			command: 'chunk', 
			chunk: data
		});
	}
}

function metadataCallback(metadata) {
	// se requieren 4 bytes de cabecera y 38 bytes de STREAMINFO
	if ( _buffersBytes < 42 ) return;

	let offset = 4;
	let data = _buffers[0]; //1st data chunk should contain FLAC identifier "fLaC"

	if ( data.byteLength < 4 || String.fromCharCode.apply(null, data.subarray(0,4) ) != 'fLaC' ) {
		return;
	}

	if ( data.length == 4 ) {
	  	data = _buffers[1]; //get 2nd data chunk which should contain STREAMINFO meta-data block (and probably more)
	  	offset = 0;
	}

	let view = new DataView(data.buffer);

	// min_blocksize (16 bits)
	view.setUint16(4 + offset, metadata.min_blocksize); // big-endian
	// max_blocksize (16 bits)
	view.setUint16(6 + offset, metadata.max_blocksize); // big-endian
	// min_framesize (24 bits)
	view.setUint8( 8 + offset, metadata.min_framesize >> 16); // 24 bit big-endian
	view.setUint8( 9 + offset, metadata.min_framesize >> 8); // 24 bit big-endian
	view.setUint8(10 + offset, metadata.min_framesize); // 24 bit big-endian
	// max_framesize (24 bits)
	view.setUint8(11 + offset, metadata.max_framesize >> 16); // 24 bit big-endian
	view.setUint8(12 + offset, metadata.max_framesize >> 8); // 24 bit big-endian
	view.setUint8(13 + offset, metadata.max_framesize); // 24 bit big-endian
	// total_samples (32 bits)
	view.setUint32(18 + offset, metadata.total_samples); // big-endian

	writeMd5(view, 22 + offset, metadata.md5sum); // hexadecimal (2 caracteres representa un byte)
}

function writeMd5(view, offset, string) {
	let lng = string.length;
	let value;

	for (let i = 0; i < lng; i += 2) {
		value = parseInt(string.substring(i, i + 2), 16);
		view.setUint8(offset, value);
		offset++;
	}
}

function writeString(view, offset, string) {
	let lng = string.length;
	let value;
	
	for (let i = 0; i < lng; i++){
		value = string.charCodeAt(i);
		view.setUint8(offset, value);
		offset++;
	}
}

function initWave(channels, sampleRate) {
	let header = new Uint8Array(44);
	let view = new DataView( header.buffer );

	/* RIFF identifier */
	writeString(view, 0, 'RIFF');
	/* file length */
	view.setUint32(4, MAX_UINT32 - 12, true); // little-endian
	/* RIFF type */
	writeString(view, 8, 'WAVE');
	/* format chunk identifier */
	writeString(view, 12, 'fmt ');
	/* format chunk length */
	view.setUint32(16, 16, true); // little-endian
	/* sample format (raw) */
	view.setUint16(20, 1, true); // little-endian
	/* channel count */
	view.setUint16(22, channels, true); // little-endian
	/* sample rate */
	view.setUint32(24, sampleRate, true); // little-endian
	/* byte rate (sample rate * block align) */
	view.setUint32(28, sampleRate * (channels * 2), true); // little-endian
	/* block align (channel count * bytes per sample) */
	view.setUint16(32, (channels * 2), true); // little-endian
	/* bits per sample */
	view.setUint16(34, 16, true); // little-endian
	/* data chunk identifier */
	writeString(view, 36, 'data');
	/* data chunk length */
	view.setUint32(40, MAX_UINT32 - 44, true); // little-endian

	writeCallback( header );
}

function encodeFlac(buffers) {
	let bufferLength = buffers[0].length;
	let bufferInt = new Int32Array( (bufferLength / _sampleRateCompression) * _channels );
	let view = new DataView( bufferInt.buffer );
	let sample;

	/*
	if ( _channels == 2 ) {
		for (let i = 0, index = 0; i < bufferLength; i += _sampleRateCompression, index += 8) {
			view.setInt32(index,   (buffers[0][i] * 0x7FFF), true); // little-endian
			view.setInt32(index+4, (buffers[1][i] * 0x7FFF), true); // little-endian
		}
	} else {
		for (let i = 0, index = 0; i < bufferLength; i += _sampleRateCompression, index += 4) {
			view.setInt32(index, (buffers[0][i] * 0x7FFF), true); // little-endian
		}
	}
	*/

	if ( _channels == 2 ) {
		for ( let i = 0, index = 0; i < bufferLength; i += _sampleRateCompression, index += 2 ) {
			sample = Math.max( -1, Math.min( 1, buffers[0][i] ) );
			bufferInt[index]   = Math.round( /*sample < 0 ? sample * 0x8000 :*/ sample * 0x7FFF );

			sample = Math.max( -1, Math.min( 1, buffers[1][i] ) );
			bufferInt[index+1] = Math.round( /*sample < 0 ? sample * 0x8000 :*/ sample * 0x7FFF );
		}
	} else {
		for ( let i = 0, index = 0; i < bufferLength; i += _sampleRateCompression, index += 1 ) {
			sample = Math.max( -1, Math.min( 1, buffers[0][i] ) );
			bufferInt[index] = Math.round( /*sample < 0 ? sample * 0x8000 :*/ sample * 0x7FFF );
		}
	}

	let flacReturn = Flac.FLAC__stream_encoder_process_interleaved(_flacEncoder, bufferInt, bufferInt.length / _channels);
	if ( flacReturn != true ) {
		throw 'Error: stream_encoder_process_interleaved returned false.';
	}
}

function encodeWave(buffers) {
	let bufferLength = buffers[0].length;
	let bufferInt = new Int16Array( (bufferLength / _sampleRateCompression) * _channels );
	let sample;

	if ( _channels == 2 ) {
		for ( let i = 0, index = 0; i < bufferLength; i += _sampleRateCompression, index += 2 ) {
			sample = Math.max( -1, Math.min( 1, buffers[0][i] ) );
			bufferInt[index]   = Math.round( /*sample < 0 ? sample * 0x8000 :*/ sample * 0x7FFF );

			sample = Math.max( -1, Math.min( 1, buffers[1][i] ) );
			bufferInt[index+1] = Math.round( /*sample < 0 ? sample * 0x8000 :*/ sample * 0x7FFF );
		}
	} else {
		for ( let i = 0, index = 0; i < bufferLength; i += _sampleRateCompression, index += 1 ) {
			sample = Math.max( -1, Math.min( 1, buffers[0][i] ) );
			bufferInt[index] = Math.round( /*sample < 0 ? sample * 0x8000 :*/ sample * 0x7FFF );
		}
	}

	writeCallback(new Uint8Array(bufferInt.buffer));
}

function finishFlac() {
	let flacReturn = Flac.FLAC__stream_encoder_finish(_flacEncoder);
	if ( flacReturn != true ) {
		throw 'Error: stream_encoder_finish returned false.';
	}

	Flac.FLAC__stream_encoder_delete(_flacEncoder);
	_flacEncoder = null;
}

function finishWave(exportData) {
	let view = new DataView( _buffers[0].buffer );

	/* file length */
	view.setUint32(4, 32 + _buffersBytes, true); // little-endian
	/* data chunk length */
	view.setUint32(40, _buffersBytes, true); // little-endian
}

function getData( type ) {
	let output = new Uint8Array(_buffersBytes);
	let buffersLength = _buffers.length;
	let offset = 0;

	for (let i = 0; i < buffersLength; i++) {
		output.set(_buffers[i], offset);
		offset += _buffers[i].byteLength;
	}

	return new Blob([output], { type: type });
}

function clear(){
	_buffers.splice(0, _buffers.length);
	_buffersBytes = 0;
}

if( !Flac.isReady() ){
	Flac.onready = function(){
		self.postMessage({
			command: 'ready'
		});
	}
} else {
	self.postMessage({
		command: 'ready'
	});
}
