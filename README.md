# Captcha Guard - Protecc your room!
This is a simple bot that allows the broadcaster to protect their room from automated spam messages.

It allows you to choose what user categories (grey, blue, purple, etc.) to whitelist automatically (lets them chat without having to solve the captcha first).

It also contains a blacklist manually added to by the mods or the broadcaster.

The whitelist and the blacklist can be modified during with commands and the lists can be exported and imported at will.
An exported list can also be used as initial data that always gets loaded with the settings. Using this, you can make it more comfortable for the users you already know, who don't fall into the automatically whitelisted user categories.

Following commands are available (use without the ""):

- **"/guard reload"**
    
    This reloads the the initial data from the settings.
- **"/guard export"**
    
    This exports a **code** you can use to import the data (on refresh of CB for example) and set as initial data in the settings. Copy the complete text after the *"Notice: "* from the first ***"{"*** to the last ***"}"***.
- **"/guard import \<code>"**
    
    This imports the data that gets exported using the above "export" command.
- **"/guard clear"**
    
    This deletes all data from all the lists and clears everything. All the people who don't fall into the categories of automatically whitelisted users will have to answer the captcha again.
- **"/guard whitelist [-add | -remove] \<username>"**
    
    Using "/guard whitelist -add thmo_" you would add me (thmo_) manually to the whitelist so I could chat without having to answer the captcha.

    Using "/guard whitelist -remove thmo_" you would remove me (thmo_) from the whitelist so I could not chat anymore and would have to answer a captcha again.
- **"/guard blacklist [-add | -remove] \<username>"**
    
    Using "/guard blacklist -add thmo_" you would add me (thmo_) manually to the blacklist so I couldn't ever chat. Blacklisted users won't receive an option to answer a captcha, they're blocked from communication.

    Using "/guard blacklist -remove thmo_" you would remove me (thmo_) from the blacklist so I would have to answer a captcha again to get added to the whitelist to chat.
    
    ***Important***: *Users in the blacklist are always blocked. If you add a blacklisted user to the whitelist, the bot will first remove the user from the blacklist and then add the user to the whitelist. If you manually change the data you get from the export and have a user in the blacklist and in the whitelist, the blacklist will get the priority!*