exports.passwordUpdated = (login_pin, password) => {
  return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Password Update Confirmation</title>
        <style>
            body {
                background-color: #ffffff;
                font-family: Arial, sans-serif;
                font-size: 16px;-
                line-height: 1.4;
                color: #333333;
                margin: 0;
                padding: 0;
            }
    
    
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                text-align: center;
            }
    
            .logo {
                max-width: 200px;
                margin-bottom: 20px;
            }
    
            .message {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 20px;
            }
    
            .body {
                font-size: 16px;
                margin-bottom: 20px;
            }
    
            .support {
                font-size: 14px;
                color: #999999;
                margin-top: 20px;
            }
    
            .highlight {
                font-weight: bold;
            }
        </style>
    
    </head>
    
    <body>
        <div class="container">
            <a href="${process.env.FRONTEND_DOMAIN}"><img class="logo"
                    src="https://edgefx.uk/static/media/favicon.9eef958df328cca45cc6.png" alt="${process.env.DOMAIN_NAME}"></a>
            <div class="message">Your Password</div>
            <div class="body">
                <p>Login Pin: ${login_pin},</p>
                <p>Your password <span class="highlight">${password}</span> has been successfully fetched for the pin <span class="highlight">${login_pin}</span>.
                </p>
                <p>If you did not request this password change, please contact us immediately to secure your account.</p>
            </div>
            <div class="support">If you have any questions or need further assistance, please feel free to reach out to us
                at
                <a href="${process.env.FRONTEND_DOMAIN}">${process.env.DOMAIN_NAME}</a>. We are here to help!
            </div>
        </div>
    </body>
    
    </html>`;
};
