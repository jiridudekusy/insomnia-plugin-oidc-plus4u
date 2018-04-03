This Insomnia plugin enables easy authentication againsts [https://oidc.plus4.net](https://oidc.plus4u.net/uu-oidcg01-main/99923616732452117-4f06dafc03cb4c7f8c155aa53f0e86be). 

# Installation

You can either install the plugin from <https://www.npmjs.com/package/insomnia-plugin-oidc-plus4u> or you can clone the git repository to Insomnia plugin folder. You can find more information at <https://support.insomnia.rest/article/26-plugins>.

# How to use ? 

The plugin register [Template Tag](https://support.insomnia.rest/article/40-template-tags) with name "Token from oidc.plus4u.net". You can use this template tag anywhere you can use environment variable (even in the environment configuration). In tag configuration you can specify the accessCode1 and accessCode2 (and you also see obtained token in the Live preview) and these credentials will be used for calling command grantToken. 

# Features

- easy Insomnia authentication against <https://oidc.plus4.net>
- support of multiple identites (credentials can be configured for each use of the template tag)
- cache (all respsonses are cached, the TTL is 10 minutes)

# Limitations

- your login information is part of insomnia configuration in **plain text** (so **never** share the workspace with this plugin to other people). It is recommended that you use this template tag only in environment variables and you clear the environment before sharing