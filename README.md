# window.fetchp

The global `fetchp` function is an easier way to make web requests and handle
responses than using an XMLHttpRequest. This polyfill is written as closely as
possible to the standard Fetch specification at https://fetchp.spec.whatwg.org.

## Installation

Available on [Bower](http://bower.io) as **fetchp**.

```sh
$ bower install fetchp
```

You'll also need a Promise polyfill for older browsers.

```sh
$ bower install es6-promise
```

This can also be installed with `npm`.

```sh
$ npm install whatwg-fetchp --save
```

(For a node.js implementation, try [node-fetchp](https://github.com/bitinn/node-fetchp))

## Usage

The `fetchp` function supports any HTTP method. We'll focus on GET and POST
example requests.

### HTML

```javascript
fetchp('/users.html')
  .then(function(response) {
    return response.text()
  }).then(function(body) {
    document.body.innerHTML = body
  })
```

### JSON

```javascript
fetchp('/users.json')
  .then(function(response) {
    return response.json()
  }).then(function(json) {
    console.log('parsed json', json)
  }).catch(function(ex) {
    console.log('parsing failed', ex)
  })
```

### Response metadata

```javascript
fetchp('/users.json').then(function(response) {
  console.log(response.headers.get('Content-Type'))
  console.log(response.headers.get('Date'))
  console.log(response.status)
  console.log(response.statusText)
})
```

### Post form

```javascript
var form = document.querySelector('form')

fetchp('/users', {
  method: 'post',
  body: new FormData(form)
})
```

### Post JSON

```javascript
fetchp('/users', {
  method: 'post',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Hubot',
    login: 'hubot',
  })
})
```

### File upload

```javascript
var input = document.querySelector('input[type="file"]')

var data = new FormData()
data.append('file', input.files[0])
data.append('user', 'hubot')

fetchp('/avatars', {
  method: 'post',
  body: data
})
```

### Caveats

The `fetchp` specification differs from `jQuery.ajax()` in mainly two ways that
bear keeping in mind:

* The Promise returned from `fetchp()` **won't reject on HTTP error status**
  even if the response is a HTTP 404 or 500. Instead, it will resolve normally,
  and it will only reject on network failure, or if anything prevented the
  request from completing.

* By default, `fetchp` **won't send any cookies** to the server, resulting in
  unauthenticated requests if the site relies on maintaining a user session.

#### Handling HTTP error statuses

To have `fetchp` Promise reject on HTTP error statuses, i.e. on any non-2xx
status, define a custom response handler:

```javascript
function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response
  } else {
    var error = new Error(response.statusText)
    error.response = response
    throw error
  }
}

function parseJSON(response) {
  return response.json()
}

fetchp('/users')
  .then(checkStatus)
  .then(parseJSON)
  .then(function(data) {
    console.log('request succeeded with JSON response', data)
  }).catch(function(error) {
    console.log('request failed', error)
  })
```

#### Sending cookies

To automatically send cookies for the current domain, the `credentials` option
must be provided:

```javascript
fetchp('/users', {
  credentials: 'same-origin'
})
```

This option makes `fetchp` behave similar to XMLHttpRequest with regards to
cookies. Otherwise, cookies won't get sent, resulting in these requests not
preserving the authentication session.

#### Receiving cookies

Like with XMLHttpRequest, the `Set-Cookie` response header returned from the
server is a [forbidden header name][] and therefore can't be programatically
read with `response.headers.get()`. Instead, it's the browser's responsibility
to handle new cookies being set (if applicable to the current URL). Unless they
are HTTP-only, new cookies will be available through `document.cookie`.

  [forbidden header name]: https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name

#### Obtaining the Response URL

Due to limitations of XMLHttpRequest, the `response.url` value might not be
reliable after HTTP redirects on older browsers.

The solution is to configure the server to set the response HTTP header
`X-Request-URL` to the current URL after any redirect that might have happened.
It should be safe to set it unconditionally.

``` ruby
# Ruby on Rails controller example
response.headers['X-Request-URL'] = request.url
```

This server workaround is necessary if you need reliable `response.url` in
Firefox < 32, Chrome < 37, Safari, or IE.

## Browser Support

![Chrome](https://raw.github.com/alrra/browser-logos/master/chrome/chrome_48x48.png) | ![Firefox](https://raw.github.com/alrra/browser-logos/master/firefox/firefox_48x48.png) | ![IE](https://raw.github.com/alrra/browser-logos/master/internet-explorer/internet-explorer_48x48.png) | ![Opera](https://raw.github.com/alrra/browser-logos/master/opera/opera_48x48.png) | ![Safari](https://raw.github.com/alrra/browser-logos/master/safari/safari_48x48.png)
--- | --- | --- | --- | --- |
Latest ✔ | Latest ✔ | 9+ ✔ | Latest ✔ | 6.1+ ✔ |
