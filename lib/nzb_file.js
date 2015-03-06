var Blast = __Protoblast,
    Str = Blast.Bound.String,
    Fn = Blast.Bound.Function,
    PassThrough = require('stream').PassThrough,
    libpath = require('path'),
    Yencer = require('yencer'),
    fs = require('fs'),
    NzbFile;

/**
 * The NzbFile class: a wrapper for a file entry inside an NZB
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.1
 * @version  0.1.3
 *
 * @param    {NzbDocument}   parent
 * @param    {Object}        filedata
 */
NzbFile = Fn.inherits('Informer', function NzbFile(parent, filedata) {

	var that = this;

	// The parent NZB document
	this.nzb = parent;

	// The nitpin instance
	this.server = parent.server;

	// The data of this file
	this.data = filedata;

	// The filename
	this.name = filedata.filename;

	// The segments (usenet articles)
	this.segments = filedata.segments;

	// The amount of downloaded segments
	this.finishedSegments = 0;

	// The suborder (like a rar-part file)
	this.suborder = 0;

	// The getBody jobs
	this.jobs = [];

	// Extract some more information
	this.triage();
});

/**
 * The current progress percentage as a getter property
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.3
 * @version  0.1.3
 */
NzbFile.setProperty(function progress() {
	return ~~((this.finishedSegments / this.segments.length) * 100);
});

/**
 * Abort the download.
 * Already made requests will not be aborted.
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.3
 * @version  0.1.3
 */
NzbFile.setMethod(function abort() {

	var aborted = 0;

	// Cancel all the jobs
	this.jobs.forEach(function eachJob(job) {
		if (!job.executed && !job.cancelled) {
			abort++;
			job.cancel();
		}
	});

	if (aborted) {
		this.emit('aborted', aborted);
	}
});

/**
 * Pause the download.
 * Already made requests will not be aborted.
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.3
 * @version  0.1.3
 */
NzbFile.setMethod(function pause() {

	var paused = 0;

	// Cancel all the jobs
	this.jobs.forEach(function eachJob(job) {
		if (!job.executed && !job.cancelled && !job.paused) {
			paused++;
			job.pause();
		}
	});

	if (paused) {
		this.emit('paused', paused);
	}
});

/**
 * Resume the download
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.3
 * @version  0.1.3
 */
NzbFile.setMethod(function resume() {

	var resumed = 0;

	// Cancel all the jobs
	this.jobs.forEach(function eachJob(job) {
		if (!job.executed && !job.cancelled && job.paused) {
			resumed++;
			job.resume();
		}
	});

	if (resumed) {
		this.emit('resumed', resumed);
	}
});

/**
 * Triage the file
 *
 * @author   Jelle De Loecker   <jelle@kipdola.be>
 * @since    0.1.1
 * @version  0.1.2
 */
NzbFile.setMethod(function triage() {

	var filename = this.name,
	    temp,
	    pars = this.nzb.pars,
	    rars = this.nzb.rars;

	// Handle parchives
	if (Str.endsWith(filename, '.par2')) {

		this.parchive = true;

		if (filename.indexOf('.vol') == -1) {
			pars.main = this;
		} else {
			pars.others.push(this);
		}

		return;
	}

	// Handle rar files with the .rar extension
	if (Str.endsWith(filename, '.rar')) {

		// Look for "part#" in the name
		temp = /\Wpart(\d+)\.rar/.exec(filename);

		if (temp) {
			// These part files start at number 1 for the first file
			this.suborder = Number(temp[1]) - 1;
		} else {
			// No "part#" found, is probably the first one
			this.suborder = 0;
		}

		// Push it to the others
		rars.others.push(this);

		return;
	}

	temp = /\.r(\d\d)$/.exec(filename);

	if (temp) {
		// These part files start at 0 for the SECOND part (first part has no number)
		this.suborder = Number(temp[1]) + 1;
		rars.others.push(this);
	}
});

/**
 * Create a stream to the file
 *
 * @author   Jelle De Loecker <jelle@kipdola.be>
 * @since    0.1.1
 * @version  0.1.3
 */
NzbFile.setMethod(function stream() {

	var that = this,
	    tasks = [],
	    orderTasks = [],
	    informer = new Blast.Classes.Informer(),
	    corrupted,
	    lastPart,
	    stream;

	// Amount of corrupted/missing segments
	corrupted = 0;

	// The passthrough stream
	stream = new PassThrough();

	// Prepare the fetching of all the file segments
	this.segments.forEach(function eachSegment(segment, index) {

		var yfile,
		    fbuffer,
		    cachehit = false;

		// Queue the task that gets the actual segment
		tasks.push(function getSegment(nextSegment) {

			var tempFilePath,
			    body;

			Fn.series(function getCache(next) {
				// Try to get the segment from the temp folder
				that.nzb.getTemp(function(err, temppath) {

					if (err) {
						return next();
					}

					tempFilePath = libpath.resolve(temppath, Blast.Bound.String.slug(segment.id));

					fs.readFile(tempFilePath, function gotFile(err, buffer) {

						if (!err) {
							cachehit = true;
							body = buffer.toString('binary');
						}

						next();
					});
				});
			}, function getSegment(next) {

				// If we already got the body, go to the deyencing fase
				if (body) {
					return next();
				}

				var job = that.server.getBody(that.data.groups, segment.id, function gotSegment(err, response) {
					body = response;

					if (err) {
						return next(err);
					}

					// If we can write the article to someplace
					if (tempFilePath) {
						fs.createWriteStream(tempFilePath).write(response, 'binary');
					}

					next();
				});

				that.jobs.push(job);
			}, function deYenc(err) {

				if (that.data.yenc) {
					// Start decoding the segment
					yfile = new Yencer.YencFile(segment);

					if (err) {
						yfile.intact = false;

						// Create a buffer, use the expected article size
						yfile.buffer = new Buffer(yfile.articlesize);

						// Indicate that there is a corrupted segment
						corrupted++;
					} else {
						yfile.decodePiece(body);

						if (!yfile.intact) {
							corrupted++;
						}
					}

					fbuffer = yfile.buffer;
				} else {
					yfile = null;
					fbuffer = new Buffer(body);
				}

				// Indicate this segment has downloaded
				that.finishedSegments++;

				// Emit progress event
				that.emit('progress', that.progress, segment.id, cachehit);

				// Emit an event to indicate this segment is done
				informer.emit('ready-' + index);

				nextSegment(null, yfile);
			});
		});

		// Queue the task that pushed the decoded buffers to the stream in order
		orderTasks.push(function pusher(nextPush) {
			informer.after('ready-' + index, function segmentIsReady() {

				if (corrupted) {
					stream.emit('corrupted-piece', yfile);

					if (corrupted == 1) {
						stream.emit('corrupted');
					}
				}

				// Write the buffer to the stream
				stream.write(fbuffer);

				nextPush();
			});
		});
	});

	// Get all the segments in parallel
	Fn.parallel(tasks, function done(err, yfiles) {

		if (err) {
			stream.emit('error', err);
		}
	});

	// Queue the stream writes, too
	Fn.series(orderTasks, function written(err) {

		if (err) {
			stream.emit('error', err);
		}

		stream.end();
	});

	return stream;
});

module.exports = NzbFile;