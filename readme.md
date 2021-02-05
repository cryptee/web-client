<img src="https://static.crypt.ee/Cryptee-github-v3.png" align="right" alt="Cryptee Logo 2021" width="100%" height="auto">


&nbsp;

---

&nbsp;


Hello there 👋

If you've found your way here, that means you're serious about your security and privacy! ~ or maybe just want to copy paste some code. Either way, you're welcome awesome human. Thanks for checking out Cryptee's source code.

First, let's get a few things out of the way.

&nbsp;

#### Security & Issues

If you find any critical security issues, please reach out to us using `info @ crypt [dot] ee`. 

Otherwise, feel free to throw in your bug reports and issues here on github! The issues section is meme & emoji friendly. Please use fun GIFs. It'll cheer everyone up. We're going through a pandemic ffs, we can all use a good laughter. So issues/bug-reports/feature suggestions with relevant & fun memes and gifs will win some free storage on the house.  

Needless to say, this doesn't mean Cryptee isn't a serious product or company, it just means you can relax, smile and take things easy. We're all humans.

![humans](https://media.giphy.com/media/OCh6NOK0nkEJG/giphy-downsized.gif)


&nbsp;

---

&nbsp;


#### Thoughts on frameworks

Chances are some of you will look at this source code and think *"WTF JQUERY!? CODEKIT!?"* or *"Y U NO ANGULAR!? WHY NOT REACT? NO GRUNT!?"*. That's okay. Take a deep breath, calm down.

When you are a small company, living frugal to ship as quickly yet as reliably as possible, when your livelihood depends on how quickly you can ship new features, and building a product that is used by thousands and thousands of others every day to gain some level of security / privacy online, one thing becomes clear:

You don't want to depend on ever-changing massive frameworks, backwards compatibility issues, or [fucking creepy licenses](https://thenextweb.com/dd/2017/09/25/facebook-re-licenses-react-mit-license-developer-backlash/).

So yeah Cryptee uses Codekit and JQuery. ~~zepto ... if we're being specific~~.

(Did you feel that? All of Silicon Valley just shuddered in disgust.)

![](https://media.giphy.com/media/12bVDtXPOzYwda/giphy.gif)


&nbsp;

---

&nbsp;

#### Why is Cryptee's backend code not open-source?

1. The main reason why Cryptee, and most other privacy-first companies are hesitant about open sourcing their backend is because it risks exposing the tightly integrated abuse-prevention systems. Opening our backend code could quickly lead to all sorts of sign-up abuse, which isn't sustainable for a small company / startup like Cryptee. (financially or technically)

2. There really isn't a trust benefit to open sourcing any backend code. Because:

    2a) It isn't possible to verify the code that is actually running on the backend.

    2b) This is also the reason why all the encryption happens on the front-end. So that you don't have to trust black-box servers running unverifiable code. Once you read the front-end source code, you can verify that your data never leaves your device unencrypted.

3. Every now and then we get requests to open source our backend code so that some users can run it on their own servers. Cryptee is a project built for everyone to have a secure home for their files. And the largest majority of the internet users aren't tech-savvy, they can't (and shouldn't have to) set up their own servers, and perhaps don't even know the meaning of the word "backend" (and shouldn't have to). But they need a secure and private place for their files and digital belongings. Spending time towards open sourcing our backend and doing so in a way that it can work on any given server is a massive undertaking, and with the very limited resources Cryptee has at the moment, this is an unsustainable approach for business, growth and development.

