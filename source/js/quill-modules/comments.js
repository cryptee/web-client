class CrypteeCommentBlot extends Inline {
    static blotName = 'comment';
    static tagName = 'mark';
    static className = 'comment';
    // static scope = Parchment.Scope.INLINE;

    static create(value) {
        const node = super.create();
        let commentid = value.id || newUUID(6);
        node.setAttribute('comment', commentid);
        node.setAttribute('time', value.time);
        node.setAttribute('contents', value.text);
        return node;
    }

    static formats(node) {
        return {
            id: node.getAttribute('comment') || newUUID(6),
            time: node.getAttribute('time'),
            text: node.getAttribute('contents')
        };
    }

    optimize(context) {
        super.optimize(context);
        
        // Remove if span is empty
        if (this.domNode.textContent.length === 0) {
            this.remove();
            return;
        }

        // Merge adjacent comments with same ID
        if (this.next instanceof CrypteeCommentBlot && 
            this.next.domNode.getAttribute('comment') === this.domNode.getAttribute('comment')) {
            this.next.moveChildren(this);
            this.next.remove();
            this.domNode.normalize();
        }
    }
    
}

Quill.register('formats/comment', CrypteeCommentBlot);

/**
 * This takes in the document's plaintext contents / deltas (optional, or it retrieves it from quill) and refreshes the comments in the modal.
 * @param {*} plaintextContents 
 */
function loadOrRefreshComments(plaintextContents) {

    plaintextContents = plaintextContents || quill.getContents();

    $("#commentslist").empty();

    let commentsHTML = [];

    for (const op of (plaintextContents.ops || [])) {
        if (op.attributes && op.attributes['comment']) {
            commentsHTML.push(renderComment(op.attributes['comment']));
        }
    }

    $("#commentslist").append(commentsHTML.join(""));  

}

function checkIfACommentIsSelected() {

    try {
        
        var lastSelRange = getLastSelectionRange();
        const button = $('#comment-floater');
        
        var selectedFormat = quill.getFormat(lastSelRange);    
        
        if (!selectedFormat.comment) { 
            button.removeClass("shown");
            $("button.cryptee-new-comment").removeClass("active");
            return; 
        }

        let commentID = selectedFormat.comment.id;
    
        // if comments list is already open, scroll to comment,
        // we don't need to show the comment floater button anymore.
        if ($("#modal-comments").hasClass("show")) {
            highlightSelectedCommentWithID(commentID);
            return;
        }

        alignCommentButtonToCommentNode();

        button.attr("comment", commentID);
        button.addClass("shown");

        $("button.cryptee-new-comment").addClass("active");

    } catch (e) {
        
    }

}

function updateCommentButtonPosition() {
    const button = $('#comment-floater');
    if (!button.hasClass("shown")) { return; }
    alignCommentButtonToCommentNode();
};

function alignCommentButtonToCommentNode(){
    let commentNode = getSelectedNode();
    if (!commentNode) { 
        $('#comment-floater').removeClass("shown");
        return; 
    }

    // Position button next to comment node
    const rect = commentNode.parentNode.getBoundingClientRect();
    let idealTargetPosX = rect.right + 3;
    let winW = $(window).width();
    
    // if button will exceed window width, 
    // inverted = show on the left side of the word instead of right
    // button is 48 wide, plus we check for some aesthetic spacing on the right
    let inverted = idealTargetPosX + 64 > winW;
    $('#comment-floater').toggleClass("inverted", inverted);
    
    let targetX = idealTargetPosX;
    if (inverted) {
        targetX = rect.left - 3 - 48; // button is 48 wide
        if (targetX < 0) { targetX = 0; }
    } 
    
    $('#comment-floater').css({
        "--x": `${targetX}px`,
        "--y": `${rect.bottom + window.scrollY - 24}px` // button is 24 high.
    });
}

$("#commentslist").on('click', 'button.delete', function(event) {
    
    let comment = $(this).parents(".comment");
    
    let commentID = comment.attr("commentid");
    
    deleteCommentWithID(commentID);
    
    comment.addClass("deleting");

    setTimeout(function () { comment.remove(); }, 500);

});

$('#comment-floater').on('click', function(event) {
    let id = $(this).attr("comment");
    highlightSelectedCommentWithID(id);
    showModal("modal-comments");
}); 

$("#commentslist").on('click', '.comment', function(event) {
    let id = $(this).attr("commentid");
    highlightSelectedCommentWithID(id, true);
});

$("#commentslist").on('focus', 'textarea', function(event) {
    let id = $(this).parents(".comment").attr("commentid");
    highlightSelectedCommentWithID(id, true);
});

function highlightSelectedCommentWithID(id, scrollToCommentAnchorInDoc) {
    id = id || "";
    scrollToCommentAnchorInDoc = scrollToCommentAnchorInDoc || false;

    if (!id) { return; }

    $(`#commentslist > .comment`).removeClass("highlighted");
    $(`.ql-editor .comment`).removeClass("selected");
    
    $(`#commentslist > .comment[commentid='${id}']`).addClass("highlighted");
    $(`.ql-editor .comment[comment='${id}']`).addClass("selected");
    
    $('#comment-floater').removeClass("shown");
    
    setTimeout(function () {
        try { $(`#commentslist > .comment[commentid='${id}']:not(.deleting)`)[0].scrollIntoView({behavior : "smooth", block: 'center'}); } catch(e) {}
    }, 500);

    if (scrollToCommentAnchorInDoc) {
        let targetAnchor = $(`.ql-editor .comment[comment='${id}']`);
        if (!targetAnchor) { return; }
        if (!targetAnchor[0]) { return; }

        let targetOffset = targetAnchor[0].offsetTop;

        if (!isPaperMode()) {
            $('.ql-editor')[0].scrollTo({
                top: targetOffset - 75,
                left: 0,
                behavior: 'smooth'
            });
        } else {
            let anchorIsOnPage = elementIsOnPageNo(targetAnchor[0]);
            goToPage(anchorIsOnPage);
        }
    }
}

function deleteCommentWithID(commentID) {
    let commentElement = $(`.ql-editor .comment[comment='${commentID}']`)[0];
    const index = getQuillIndexOfDOMNode(commentElement);
    const length = commentElement.textContent.length;
    quill.formatText(index, length, "comment", false);
}

function newComment() {
    
    loadOrRefreshComments();
    
    let cursorOnCommentID = $(`.ql-editor .comment.hascursor`).attr("comment");
    // if cursor is currently on a comment and the button is active
    if ($("button.cryptee-new-comment.active") && cursorOnCommentID) {
        highlightSelectedCommentWithID(cursorOnCommentID);
        showModal("modal-comments");
        return;
    }
    
    // just in case if the button isn't active for some reason, fallback detection using quill deltas
    var curFormat = quillSafelyGetFormat();
    if (curFormat.comment) {
        cursorOnCommentID = curFormat.comment.id
        highlightSelectedCommentWithID(cursorOnCommentID);
        showModal("modal-comments");
        return;
    }

    let { index, length } = getLastSelectionRange();
    
    if (!length) {
        createPopup("To add a comment, first select/highlight some text, then press this button again", "info");
        return;
    }

    let commentID = newUUID(6);

    quill.format('comment', {
        id : commentID,
        time: Date.now(),
        text: ''
    });

    loadOrRefreshComments();

    showModal("modal-comments");

    setTimeout(function () {
        $(`#commentslist > .comment`).removeClass("highlighted");
        $(`.ql-editor .comment`).removeClass("selected");
        $(`#commentslist > .comment[commentid='${commentID}']`).addClass("highlighted");
        $(`.ql-editor .comment[comment='${commentID}']`).addClass("selected");
        try { $(`#commentslist > .comment[commentid='${commentID}:not(.deleting)']`)[0].scrollIntoView({behavior : "smooth", block: 'center'}); } catch (e) {}
        $(`#commentslist > .comment[commentid='${commentID}'] > textarea`).trigger("focus");
    }, 500);

}

$("#commentslist").on('keyup', 'textarea', function(event) {
    let id = $(this).parents(".comment").attr("commentid");
    let value = $(this).val().trim();
    updateComment(id, value);
});

/**
 * Updates the text of a comment. Also purifies and tries to do a little bit of validation.
 * @param {*} id 
 * @param {*} value 
 */
function updateComment(id, value) {

    let b64Comment = btoa(value);

    let curTime = Date.now();
    $(`.ql-editor .comment[comment='${id}']`).attr({
        "contents": b64Comment,
        "time" : curTime
    });

    let time = new Date(curTime).toLocaleString("sv-SE") || "";
    $(`#commentslist > .comment[commentid='${id}'] > time`).text(time);
}

$("#showCommentsButton").on('click', function() {
    var on = $(this).hasClass("on");

    if (on) {
        // hide comments
        $("body").addClass("comments-hidden");
        $("#showCommentsButton").removeClass("on");
    } else {
        // show comments
        $("body").removeClass("comments-hidden");
        $("#showCommentsButton").addClass("on");
    }
});

function handlePastingComments(node, delta) {
    
    var ops = [];
    delta.ops.forEach(function(op) {
        if (op.attributes) {
            if (op.attributes.comment) {
                op.attributes.comment.id = newUUID(6);
            }
        }
        ops.push(op);
    });

    setTimeout(loadOrRefreshComments, 100);

    return delta;
    
}