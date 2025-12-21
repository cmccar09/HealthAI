# AWS Amplify Deployment Guide for HealthAI

## Option 1: Deploy via AWS Console (Recommended)

### Step 1: Push Code to GitHub (if not already done)

```bash
# Initialize git if needed
cd frontend
git init
git add .
git commit -m "Initial commit"

# Create a new GitHub repository and push
git remote add origin https://github.com/YOUR-USERNAME/healthai-frontend.git
git push -u origin main
```

### Step 2: Deploy to AWS Amplify

1. **Go to AWS Amplify Console**
   - Navigate to https://console.aws.amazon.com/amplify/
   - Click "New app" → "Host web app"

2. **Connect Repository**
   - Select "GitHub" as your source
   - Authorize AWS Amplify to access your GitHub
   - Select your `healthai-frontend` repository
   - Select the `main` branch

3. **Configure Build Settings**
   - Amplify will auto-detect the `amplify.yml` file
   - Review the build settings (should match amplify.yml)
   - Click "Next"

4. **Add Environment Variables**
   Click "Advanced settings" and add:
   ```
   REACT_APP_AWS_ACCESS_KEY_ID=your_access_key
   REACT_APP_AWS_SECRET_ACCESS_KEY=your_secret_key
   REACT_APP_AWS_REGION=us-east-1
   ```
   
   ⚠️ **Security Note**: For production, use AWS Cognito or IAM roles instead of hardcoded credentials.

5. **Review and Deploy**
   - Review all settings
   - Click "Save and deploy"
   - Wait 2-5 minutes for deployment

6. **Get Your URL**
   - After deployment, you'll get a URL like: `https://main.xxxxxx.amplifyapp.com`
   - This is your production URL!

---

## Option 2: Deploy via AWS CLI

### Prerequisites

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify
amplify configure
```

### Deploy

```bash
cd frontend

# Initialize Amplify
amplify init
# Choose:
# - App name: healthai
# - Environment: prod
# - Default editor: Visual Studio Code
# - App type: javascript
# - Framework: react
# - Source directory: src
# - Distribution directory: build
# - Build command: npm run build
# - Start command: npm start

# Add hosting
amplify add hosting
# Choose: Hosting with Amplify Console
# Choose: Manual deployment

# Configure environment variables
amplify env add
# Set REACT_APP_AWS_ACCESS_KEY_ID
# Set REACT_APP_AWS_SECRET_ACCESS_KEY
# Set REACT_APP_AWS_REGION

# Publish
amplify publish
```

---

## Post-Deployment

### 1. Test Your Application

Visit your Amplify URL: `https://main.xxxxxx.amplifyapp.com`

### 2. Configure Custom Domain (Optional)

1. Go to Amplify Console → Your App → "Domain management"
2. Click "Add domain"
3. Follow instructions to add your custom domain
4. Wait for SSL certificate provisioning (5-10 minutes)

### 3. Set Up CI/CD

Amplify automatically sets up CI/CD:
- Every push to `main` branch triggers a new deployment
- Pull requests create preview deployments
- Rollback to previous versions anytime

---

## Environment Variables for Production

For better security in production, consider using:

### Option A: AWS Cognito (Recommended)

Instead of hardcoded credentials, use Cognito Identity Pool:

```javascript
// src/aws-config.js
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

const credentials = fromCognitoIdentityPool({
  client: new CognitoIdentityClient({ region: "us-east-1" }),
  identityPoolId: "us-east-1:xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx"
});
```

### Option B: API Gateway + IAM (Most Secure)

Route all AWS requests through API Gateway instead of direct SDK calls.

---

## Troubleshooting

### Build Fails

- Check that `amplify.yml` is in the repository root
- Verify all dependencies in `package.json`
- Check build logs in Amplify Console

### Environment Variables Not Working

- Ensure variables start with `REACT_APP_`
- Rebuild the app after adding variables
- Check that variables are set in Amplify Console

### AWS SDK Errors

- Verify credentials have correct DynamoDB and S3 permissions
- Check IAM policy includes:
  - `dynamodb:Scan`, `dynamodb:Query`
  - `s3:GetObject`

---

## Monitoring

### View Logs

1. Go to Amplify Console → Your App
2. Click on a deployment
3. View build logs and deployment details

### Set Up Alerts

1. Go to "Monitoring" tab
2. Enable CloudWatch alarms for:
   - Build failures
   - 4xx/5xx errors
   - Response time

---

## Cost Estimation

AWS Amplify Pricing:
- **Build & Deploy**: $0.01 per build minute
- **Hosting**: $0.15 per GB served
- **Free Tier**: 1,000 build minutes/month, 15 GB served/month

Estimated monthly cost for low traffic: **$0-5/month**

---

## Your HealthAI Amplify URL

✅ **Live Application:**

```
🌐 Production: https://master.d2u43pjwtpmlz9.amplifyapp.com
```

🎉 Your HealthAI application is now live and accessible to users!

### Share Your Application:
- Add this URL to your README.md
- Share with healthcare providers and administrators
- Set up custom domain for professional branding (optional)
