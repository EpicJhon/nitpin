# Nitpin

Nitpin is an NNTP (Usenet/Newsgroups) client library written in JavaScript for node.js/io.js.

## Install

```bash
$ npm install nitpin
```

## Features

* Handles multiple connections
* Reaps idle connections after 30 seconds of inactivity

## Todo

* Add support for more commands
* Multi-server support
* Possible NZB handling & yEnc decoding
* ...

## Available command methods

* getHead (HEAD)
* getBody (BODY)
* getArticle (ARTICLE)
* stat (STAT)
* over (XZVER/XOVER/OVER)
* group (GROUP)
* capabilities (CAPABILITIES)
* list (LIST ACTIVE [wildmat])

## Examples

### Create a Nitpin instance

```javascript
var Nitpin = require('nitpin'),
    server = new Nitpin({
        host: 'news.php.net', // Example uses the open PHP newsgroups server
        user: null,           // Example doesn't need username
        pass: null,           // Nor password
        port: 119,
        secure: false,
        connections: 1        // 1 is the default amount of connections
    });
```

### Get an overview of messages for the given group

```javascript
// Automatically tries XZVER, falls back to XOVER when not available
server.over('php.doc.nl', 2, 5, function gotMessages(err, messages) {

    console.log(messages[0]);
    // { id: '2',
    // subject: 'test',
    // from: 'd.rethans@jdimedia.nl (Derick Rethans)',
    // date: 'Mon, 24 Jun 2002 14:54:22 +0200 (CEST)',
    // 'message-id': '<Pine.LNX.4.44.0206241454120.20549-100000@jdi.jdimedia.nl>',
    // references: '',
    // bytes: '',
    // lines: '9',
    // xref: 'php.doc.nl:2' }
});
```

### Get an article

```javascript
// Get a specific article from a group
server.getArticle('php.doc.nl', 'Pine.LNX.4.44.0206241454120.20549-100000@jdi.jdimedia.nl', function gotArticle(err, headers, body) {

    console.log(headers);
    // { path: 'news.php.net',
    //  xref: 'news.php.net php.doc.nl',
    //  'return-path': '<d.rethans@jdimedia.nl>',
    //  'mailing-list': 'contact doc-nl-help@lists.php.net; run by ezmlm',
    //  'delivered-to': 'mailing list doc-nl@lists.php.net',
    //  received: 'from jdi.jdimedia.nl (jdi.jdimedia.nl [212.204.192.51])\n\tby jdi.jdimedia.nl (8.12.4/8.12.4) with ESMTP id g5OCsM6M021379\r',
    //  'by pb1.pair.com with smtp; 24 jun 2002 12': '53',
    //  'for <doc-nl@lists.php.net>; mon, 24 jun 2002 14': '54',
    //  date: 'Mon, 24 Jun 2002 14',
    //  'x-x-sender': 'derick@jdi.jdimedia.nl',
    //  to: 'doc-nl@lists.php.net',
    //  'message-id': '<Pine.LNX.4.44.0206241454120.20549-100000@jdi.jdimedia.nl>',
    //  'mime-version': '1.0',
    //  'content-type': 'TEXT/PLAIN; charset=US-ASCII',
    //  subject: 'test',
    //  from: 'd.rethans@jdimedia.nl (Derick Rethans)' }
});
```

## License

MIT