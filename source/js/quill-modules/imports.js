var Parchment =         Quill.import('parchment');
var Delta =             Quill.import('delta');

var List =              Quill.import('formats/list');
var Font =              Quill.import('formats/font');
var Bold =              Quill.import('formats/bold');
var BaseImageFormat =   Quill.import('formats/image');
var Italic =            Quill.import('formats/italic');

var HistoryModule =     Quill.import('modules/history');
var Keyboard =          Quill.import('modules/keyboard');
var Clipboard =         Quill.import('modules/clipboard');

var Embed =             Quill.import('blots/embed');
var Block =             Quill.import('blots/block');
var Inline =            Quill.import('blots/inline');
var Container =         Quill.import('blots/container');
var BlockEmbed =        Quill.import('blots/block/embed');

var fontSizeStyle =     Quill.import('attributors/style/size');

var quillIcons =        Quill.import('ui/icons');

// Lower index means deeper in the DOM tree, since not found (-1) is for embeds
Inline.order = [
    'cursor', //must be lower
    'inline', 
    'link', 
    'w', // must be lower so we can break words better for pages (nest w as deep as possible)
    'font',
    'size',
    'color', 
    'background',
    'bold', 
    'italic', 
    'strike', 
    'underline', 
    'script',
    'code', 
    'folder',
    'file',
    'tag',
    'comment', //must be higher
]