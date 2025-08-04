# MongoDB Atlas Setup Guide

This guide will walk you through setting up MongoDB Atlas for your WP Aggregator AI chatbot.

## Why MongoDB Atlas?

MongoDB Atlas is MongoDB's cloud database service that provides:

- ✅ **Free tier** available (512 MB storage)
- ✅ **No local setup** required
- ✅ **Automatic backups** and security
- ✅ **Global availability** and performance
- ✅ **Easy scaling** as your data grows

## Step-by-Step Setup

### 1. Create Your Atlas Account

1. Visit [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Click "Try Free"
3. Sign up with your email or Google/GitHub account
4. Complete the account verification

### 2. Create a New Cluster

1. After login, you'll see the "Create a cluster" page
2. **Choose your plan**: Select "M0 Sandbox" (FREE forever)
3. **Choose cloud provider**: AWS, Google Cloud, or Azure (any is fine)
4. **Choose region**: Pick one closest to your location for better performance
5. **Cluster name**: Enter a name like "wp-aggregator-cluster"
6. Click "Create Cluster" (this takes 2-3 minutes)

### 3. Configure Database Access

1. While your cluster is creating, click "Database Access" in the left sidebar
2. Click "Add New Database User"
3. **Authentication Method**: Choose "Password"
4. **Username**: Create a username (e.g., "wp-aggregator-user")
5. **Password**: Generate a secure password or create your own
   - ⚠️ **Important**: Save this password securely!
6. **Database User Privileges**: Select "Read and write to any database"
7. Click "Add User"

### 4. Configure Network Access

1. Click "Network Access" in the left sidebar
2. Click "Add IP Address"
3. **For development**:
   - Click "Allow Access from Anywhere"
   - This adds `0.0.0.0/0` (all IPs)
4. **For production**:
   - Add your specific server IPs
   - You can add multiple IPs as needed
5. Click "Confirm"

### 5. Get Your Connection String

1. Go back to "Clusters" (Database → Clusters)
2. Wait for your cluster status to show "Active" (green)
3. Click the "Connect" button on your cluster
4. Choose "Connect your application"
5. **Driver**: MongoDB driver (should be pre-selected)
6. **Version**: 4.1 or later (should be pre-selected)
7. **Copy the connection string**

### 6. Configure Your Application

1. Open your `.env` file in the project root
2. Replace the `MONGODB_URI` value with your Atlas connection string
3. **Important**: Replace `<password>` with your actual database user password

**Example:**

```env
MONGODB_URI=mongodb+srv://wp-aggregator-user:YOUR_ACTUAL_PASSWORD@wp-aggregator-cluster.abc123.mongodb.net/wp-aggregator-ai?retryWrites=true&w=majority
```

### 7. Test Your Connection

1. Start your application:

   ```bash
   npm run dev
   ```

2. Look for the success message:

   ```
   ✅ Connected to MongoDB Atlas
   ```

3. If you see connection errors, double-check:
   - Your password in the connection string
   - Network access settings (0.0.0.0/0 for development)
   - Database user permissions

## Connection String Breakdown

Your connection string has several parts:

```
mongodb+srv://[username]:[password]@[cluster-url]/[database-name]?[options]
```

- **username**: Your database user
- **password**: Your database user password (replace `<password>`)
- **cluster-url**: Your cluster's URL (unique to your cluster)
- **database-name**: `wp-aggregator-ai` (your app's database)
- **options**: Connection options for reliability

## Security Best Practices

### For Development:

- ✅ Use "Allow Access from Anywhere" (0.0.0.0/0)
- ✅ Use environment variables for connection strings
- ✅ Never commit `.env` files to version control

### For Production:

- ✅ Restrict IP access to your server's specific IPs
- ✅ Use strong, unique passwords
- ✅ Enable additional Atlas security features
- ✅ Set up monitoring and alerts

## Troubleshooting

### "Authentication failed"

- Check your username and password in the connection string
- Ensure the database user exists in "Database Access"

### "Connection timed out"

- Check "Network Access" settings
- Ensure your IP is whitelisted
- Try adding 0.0.0.0/0 for testing

### "Database not found"

- This is normal! MongoDB will create the database automatically
- The database will appear after your first data insert

### "Too many connections"

- Free tier has connection limits
- Ensure you're closing connections properly
- Consider upgrading if needed

## Free Tier Limits

MongoDB Atlas M0 (free tier) includes:

- 512 MB storage
- Shared RAM and vCPU
- No backup snapshots
- 100 max connections
- Community support

These limits are sufficient for development and small applications.

## Next Steps

Once connected:

1. Start scraping WordPress tickets: `npm run scrape recent 10`
2. Test the chatbot with ticket search queries
3. Monitor your database usage in the Atlas dashboard

## Support

- **Atlas Documentation**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **Community Forums**: [community.mongodb.com](https://community.mongodb.com)
- **University**: [university.mongodb.com](https://university.mongodb.com) (free courses)

Happy coding! 🚀
