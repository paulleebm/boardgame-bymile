# boardgame-bymile

This project uses Firebase for authentication and data storage. The actual Firebase project credentials are intentionally excluded from version control.

To enable login and other Firebase features, create a `public/firebase-config.js` file with your project's configuration:

```bash
cp public/firebase-config.example.js public/firebase-config.js
# then edit public/firebase-config.js with your credentials
```

Without this file the login button will not function.
