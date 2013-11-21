var N3Writer = require('../N3').Writer;
var vows = require('vows'),
    chai = require('chai'),
    expect = chai.expect,
    util = require('util');
chai.should();
chai.use(require('chai-things'));

vows.describe('N3Parser').addBatch({
  'The N3Writer module': {
    topic: function () { return N3Writer; },

    'should be a function': function (N3Writer) {
      N3Writer.should.be.a('function');
    },

    'should make N3Writer objects': function (N3Writer) {
      N3Writer().should.be.an.instanceof(N3Writer);
    },

    'should be an N3Writer constructor': function (N3Writer) {
      new N3Writer().should.be.an.instanceof(N3Writer);
    },
  },

  'An N3Writer instance': {
    topic: function () { return function (stream, prefixes) { return new N3Writer(stream, prefixes); }; },

    'should serialize 0 triples':
      shouldSerialize([], ''),

    'should serialize 1 triple':
      shouldSerialize([['abc', 'def', 'ghi']],
                      '<abc> <def> <ghi>.\n'),

    'should serialize 2 triples':
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['jkl', 'mno', 'pqr']],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n'),

    'should serialize 3 triples':
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['jkl', 'mno', 'pqr'],
                       ['stu', 'vwx', 'yz']],
                      '<abc> <def> <ghi>.\n' +
                      '<jkl> <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'),

    'should serialize a literal':
      shouldSerialize([['a', 'b', '"cde"']],
                      '<a> <b> "cde".\n'),

    'should serialize a literal with a type':
      shouldSerialize([['a', 'b', '"cde"^^<fgh>']],
                      '<a> <b> "cde"^^<fgh>.\n'),

    'should serialize a literal with a language':
      shouldSerialize([['a', 'b', '"cde"@en-us']],
                      '<a> <b> "cde"@en-us.\n'),

    'should serialize a literal containing a single quote':
      shouldSerialize([['a', 'b', '"c\'de"']],
                      '<a> <b> "c\'de".\n'),

    'should serialize a literal containing a double quote':
      shouldSerialize([['a', 'b', '"c"de"']],
                      '<a> <b> "c\\"de".\n'),

    'should serialize a literal containing a backspace':
      shouldSerialize([['a', 'b', '"c\\de"']],
                      '<a> <b> "c\\\\de".\n'),

    'should serialize a literal containing a tab character':
      shouldSerialize([['a', 'b', '"c\tde"']],
                      '<a> <b> "c\\tde".\n'),

    'should serialize a literal containing a newline character':
      shouldSerialize([['a', 'b', '"c\nde"']],
                      '<a> <b> "c\\nde".\n'),

    'should serialize a literal containing a cariage return character':
      shouldSerialize([['a', 'b', '"c\rde"']],
                      '<a> <b> "c\\rde".\n'),

    'should serialize a literal containing a backspace character':
      shouldSerialize([['a', 'b', '"c\bde"']],
                      '<a> <b> "c\\bde".\n'),

    'should serialize a literal containing a form feed character':
      shouldSerialize([['a', 'b', '"c\fde"']],
                      '<a> <b> "c\\fde".\n'),

    'should not serialize a literal in the subject':
      shouldNotSerialize([['"a"', 'b', '"c']],
                          'A literal as subject is not allowed: "a"'),

    'should not serialize a literal in the predicate':
      shouldNotSerialize([['a', '"b"', '"c']],
                          'A literal as predicate is not allowed: "b"'),

    'should serialize valid prefixes':
      shouldSerialize({ a: 'http://a.org/',
                        b: 'http://a.org/b#',
                        c: 'http://a.org/b' },
                      [],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n'),

    'should use prefixes when possible':
      shouldSerialize({ a: 'http://a.org/',
                        b: 'http://a.org/b#',
                        c: 'http://a.org/b' },
                      [['http://a.org/bc', 'http://a.org/b#ef', 'http://a.org/bhi'],
                       ['http://a.org/bc/de', 'http://a.org/b#e#f', 'http://a.org/b#x/t'],
                       ['http://a.org/3a', 'http://a.org/b#3a', 'http://a.org/b#a3']],
                      '@prefix a: <http://a.org/>.\n' +
                      '@prefix b: <http://a.org/b#>.\n\n' +
                      'a:bc b:ef a:bhi.\n' +
                      '<http://a.org/bc/de> <http://a.org/b#e#f> <http://a.org/b#x/t>.\n' +
                      '<http://a.org/3a> <http://a.org/b#3a> b:a3.\n'),

    'should not repeat the same subjects':
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['abc', 'mno', 'pqr'],
                       ['stu', 'vwx', 'yz']],
                      '<abc> <def> <ghi>;\n' +
                      '    <mno> <pqr>.\n' +
                      '<stu> <vwx> <yz>.\n'),

    'should not repeat the same predicates':
      shouldSerialize([['abc', 'def', 'ghi'],
                       ['abc', 'def', 'pqr'],
                       ['abc', 'bef', 'ghi'],
                       ['abc', 'bef', 'pqr'],
                       ['stu', 'bef', 'yz']],
                      '<abc> <def> <ghi>, <pqr>;\n' +
                      '    <bef> <ghi>, <pqr>.\n' +
                      '<stu> <bef> <yz>.\n'),

    'should write rdf:type as "a"':
      shouldSerialize([['abc', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'def']],
                      '<abc> a <def>.\n'),
  },
}).export(module);

function shouldSerialize(prefixes, tripleArrays, expectedResult) {
  if (!expectedResult)
    expectedResult = tripleArrays, tripleArrays = prefixes, prefixes = null;
  return {
    topic: function (n3writerFactory) {
      var callback = this.callback,
          outputStream = new QuickStream(),
          writer = n3writerFactory(outputStream, prefixes);
      (function next() {
        var item = tripleArrays.shift();
        if (item)
          writer.addTriple({ subject: item[0], predicate: item[1], object: item[2] }, next);
        else
          writer.end(function () { callback(null, outputStream.result); });
      })();
    },
    'should equal the expected result': function (actual) {
      actual.should.equal(expectedResult);
    },
  };
}

function shouldNotSerialize(tripleArrays, expectedMessage) {
  return {
    topic: function (n3writerFactory) {
      var outputStream = new QuickStream(),
          writer = n3writerFactory(outputStream);
      var item = tripleArrays.shift();
      writer.addTriple({ subject: item[0], predicate: item[1], object: item[2] },
                       this.callback.bind(this, null));
    },
    'should produce the right error message': function (error) {
      error.message.should.equal(expectedMessage);
    },
  };
}

function QuickStream() {
  var stream = {}, buffer = '';
  stream.write = function (chunk, encoding, callback) { buffer += chunk; callback && callback(); };
  stream.end = function (callback) { stream.result = buffer; buffer = null; callback(); };
  return stream;
}