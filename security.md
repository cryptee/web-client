# Vulnerability Disclosure Policy

We're all humans folks, and all humans make mistakes at some point in their lives. So we believe that working and collaborating with other security researchers around the world is the only way to keep you and your data safe. 

This policy specifies : 
- How to report potential security issues and vulnerabilities to us
- What systems and applications are in scope
- What types of security research methods are cool and covered
- Our vulnerability disclosure process and how long we may ask you to wait before going public

If you comply with this policy during your security research, your work will be considered authorized under Cryptee’s safe harbor policy. We will assist in resolving the issue quickly and will not pursue legal action against you for your research activities.

# Test Methods
### Security researchers must not : 
- Test any system other than the systems set forth in the Scope section below. 
- Disclose vulnerability related information except as set forth in the Reporting a vulnerability and Disclosure sections below.
- Engage in physical testing of facilities or resources. 

*Seriously folks, our data centers & offices are at the heart of the city, and we have physical, armed security staff and police around who do not take this stuff lightly.*

- Engage in social engineering techniques or harrass our team members in any way.
- Send unsolicited electronic mail to Cryptee users, including “phishing” messages.
- Execute or attempt to execute “denial of service” or “resource exhaustion” attacks. 
- Introduce malicious software in the systems of Cryptee or any third party.
- Perform tests that could degrade the operation of Cryptee systems or intentionally impair, disrupt, or disable our systems
- Test third-party applications, websites, or services that integrate with or link to or from Cryptee systems
- Delete, alter, share, retain, or destroy Cryptee data, or render Cryptee data inaccessible
- Use an exploit to exfiltrate data, establish command line access, establish a persistent presence on Proton systems, or “pivot” to other Cryptee systems

### Security researchers may : 
- View or store Cryptee data only to the extent necessary to document a potential vulnerability
- Contact our team or staff to discuss potential vulnerabilities via email, signal (if provided by our team) or other means of communication

### Security researchers must : 
- Stop testing and notify us immediately upon discovery of a vulnerability or exposure of non-public data
- Purge any stored non-public data upon reporting a vulnerability

# Scope
### The following systems and services are in scope : 

Security issues in any : 

- live (https://crypt.ee)
- beta (https://beta.crypt.ee)
- photos (https://cryptee.photos) 

releases of Cryptee are the three most important products you should keep an eye out for. This includes our web app and/or APIs facilitating the apps. Whichever is applicable.

You can check out the source code for our web app here on github. It is updated in realtime —as a part of our build process— as soon as there's a new release. Inside each web app (current/beta), on the [Account Settings](https://crypt.ee/account?s=overview) page (while logged in), in the top right corner you can find a github commit hash like [4b0144e](https://github.com/cryptee/web-client/commit/4b0144e3ca5da9c9dc18d4d329434d5e08bab7ec). You can utilize this hash to check out the exact current/beta commit and code that is in use for the version of the app you're using.

### Anything unrelated to what's listed above is not in scope. For example :

- Spam
- Social engineering techniques
- Denial-Of-Service attacks
- Content injection is out of scope unless you can clearly demonstrate a significant risk to Cryptee or its users. 
- Executing scripts on sandboxed domains.
- Web app crash reports that aren't reproducible on up-to-date operating system versions or mobile devices or browsers released within the last 730 days.
- Security issues outside the scope of Cryptee's mission. 

*(i.e. "Hey! I found a security issue in Mozilla Firefox! Can you guys help me reach out to Firefox devs?" is out of scope — though admittedly very interesting and formidable)*

- Bugs that require exceedingly unlikely user interactions. 

*(i.e. "So first the user needs to take a shower, then they need to launch Cryptee with their slightly slippery left hand, drop the phone at a 13° angle 1.5m above the ground onto the 30% wet surface, where at impact the water droplets on the bathroom floor will launch their browser's inspector console and execute a self-XSS attack" = rick and morty levels of genius, you should consider a career in hollywood movies writing hacker scenes, but sadly out of scope. though you are welcome to email fun stuff like this our way if you'd like)*

- Proof of concepts that require physical access to the device. 
- Out-of-date software. For a variety of reasons, we don't always run the most recent software versions (i.e. a/b testing a feature roll-out on beta channel etc), but we do run software that's always fully patched.
- Flaws impacting out-of-date browsers. (older than 730 days)
- Flaws impacting older operating systems (older than 730 days)

# Reporting a vulnerability or security issue

### If you found a security issue in Cryptee : 
Be it the apps or the service in general, please reach out to us using : `security @ crypt [dot] ee`.

- Reach out to us as quickly as humanly possible. We have many at risk users using our service, and your speed could literally save lives. We will do our best to quickly address the issue.
- Please provide us as much information and steps as possible to reproduce the issue. Even better, —where applicable— if you have a proof of concept we can test with, send it over! (don't forget to include a list of tools needed to identify or exploit the vulnerability)
- Images and videos (i.e. screenshots / recordings etc) and other documents may be attached to reports. It's especially helpful if you give the attachment files some easy to understand names. 
- Please, *Please*, **Please**, ***we request*** that any scripts or exploit code to be embedded into non-executable file types. Thing is if you send us an executable file type, we're just not going to open it for security reasons. So please. 
- We can process all common file types and archives (incl zip, 7zip, gzip etc)
- If you discovered a vulnerability in Cryptee Docs, specific to our document editor, send us a .uecd file. (or a .ecd file and write down the key we need to open it. We'll try it out in a test account.)
- Similarly, if you've discovered an account specific vulnerability, and don't mind sharing the details with us, please send us the test account's username/email, password and encryption key.
- We know that some countries have laws restricting reverse engineering, and publicly disclosing your location may be a violation of those laws. If you are in such a country, please let us know.
- If you find vulnerabilities as part of your work, or on equipment owned by your employer, your employer may prevent you from reporting these issues to us as a part of your company's policy. Please read your contract carefully and consider taking legal advice before doing so. In these rare circumstances we may not be legally able to attribute the findings to your individual name directly, but instead may be legally required to write your employer's name.

You may submit reports anonymously or provide contact information, including how and when our security team should contact you. We may contact you to clarify aspects of the report or to gather other technical information. 

By submitting us a report, you affirm that the report and any attachments do not violate the intellectual property rights of any third party. You also grant Cryptee a non-exclusive, royalty-free, worldwide, perpetual license to use, reproduce, create derivate works, and publish the report and any attachments.

### If you found a bug, mistake or typo, but not a security issue :

Feel free to throw in your bug reports and issues here on github! 

The issues section is meme & emoji friendly. Please use fun GIFs. It will cheer everyone up. We have been through a pandemic ffs, we can all use a good laughter. So issues/bug-reports/feature suggestions with relevant & fun memes and gifs will win some free storage on the house.  

Needless to say, this doesn't mean Cryptee isn't a serious product or company, it just means you can relax, smile and take things easy for a few minutes. We're all humans.

# Disclosure Policy

We are a small team, trying to the best by our users, committed to timely fixes and patches. We will work around the clock to resolve issues that put our community at risk. We kindly ask you to bear with us as we go through the reports you submit to us, as the public disclosure of a vulnerability in the absence of a ready-available fix likely increases our community's security risk. 

So please refrain from sharing information about discovered vulnerabilities for 120 calendar days after you have received our acknowledgement of receipt of your report. If you believe others should be informed of the vulnerability prior to our fixes and patches, you must coordinate in advance with our security team first.

We may share vulnerability reports with affected vendors. Unless given explicit permission, we will not share the names or contact data of security researchers.

If it's appropriate, we may publicly disclose the issue before addressing it. (*with credits to you of course — if you permit*)

# Questions? 

If you have any further questions regarding this policy, feel free to reach out to `security @ crypt [dot] ee`.
*(And please don't be shy, we encourage you to contact if you have any questions at all)*

Also, please contact us if you're unsure if a specific test method is inconsistent with or unaddressed by this policy before you begin testing. 

Finally, we invite you to contact us with suggestions for improving this policy. We worked our legal team trying to put together a nice and cozy policy, and we know it may sound restricting. Please know that we're open for feedback and we're friendly folks who just want to do right by our community to keep them safe.

# Acknowledgements

We appreciate the help of everyone who reaches out to us! 
We have a [public acknowledgements page](https://crypt.ee/acknowledgments) where we link to all research and security findings, and we would love to include your research there too **if choose to share your identity and make your research public**.