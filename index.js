const AWS = require('aws-sdk');
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');
const mailgun = require('mailgun-js');

// Initialize AWS SDK
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB();

// Initialize Google Cloud Storage
const googleCred = process.env.GOOGLE_CREDENTIALS;
const googleCredsJson = Buffer.from(googleCred, 'base64').toString('utf-8');
console.log(googleCredsJson);

// Initialize Google Cloud Storage with credentials
const storage = new Storage({credentials: JSON.parse(googleCredsJson),});
console.log(storage);
//const storage = new Storage();

//const storage = new Storage({ credentials: GOOGLE_CREDENTIALS });
exports.handler = async (event) => {
    try {
        console.log("Received event:", JSON.stringify(event, null, 2));

        // Extract SNS message
        const snsMessage = JSON.parse(event.Records[0].Sns.Message);
        console.log("SNS Message:", snsMessage);
        console.log("Email:",snsMessage.email);
        console.log("Submission URL:- ", snsMessage.submissionUrl);

        // GitHub release details
        const githubRepo = snsMessage.submissionUrl;
        console.log("git hub repo", githubRepo);
        //const releaseTag = snsMessage.releaseTag;

        // Google Cloud Storage details
        //const bucketName = snsMessage.bucketName;
        const bucketName = process.env.BUCKET_NAME;
        console.log("bucketName",bucketName);
        const objectName = githubRepo;
        console.log("objectName", objectName);


        // DynamoDB details
        const dynamoDbTable = process.env.DYNAMODB;


        // Download release from GitHub
        const githubReleaseUrl = githubRepo;
        console.log("githubReleaseUrl",githubReleaseUrl);

        const response = await axios.get(githubReleaseUrl, { responseType: 'arraybuffer' });
        console.log("response:- " ,response)
        
        // Upload release to Google Cloud Storage
        await storage.bucket(bucketName).file(objectName).save(response.data);

        // Email user the status of download (replace this with your email sending logic)
        const emailStatus = await sendEmail(snsMessage.email, "Download Status", "Release downloaded successfully!");
        console.log("Email Status:- ",emailStatus);

        // Track emails sent in DynamoDB
        await trackEmailInDynamoDB(snsMessage.Email, snsMessage.submissionUrl,emailStatus);

        return {
            statusCode: 200,
            body: JSON.stringify('Lambda function executed successfully'),
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify('Error executing Lambda function'),
        };
    }
};

async function sendEmail(to, subject, message) {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const mg = mailgun({ apiKey, domain });

    const from = `noreply@${domain}`;

    console.log(to);
    console.log(from);
    const data = {
        from,
        to,
        subject,
        text: message,
    };

    try {
        const response = await mg.messages().send(data);
        console.log("Email sent successfully:", response);
        return { success: true, message: "Email sent successfully" };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, message: "Error sending email" };
    }
}

async function trackEmailInDynamoDB(email, fileName, isSuccess) {
    const tableName = process.env.DYNAMODB;
    const status = isSuccess ? "Success" : "Failure";
    console.log(status);
     
    const params = {
      TableName: tableName,
      Item: {
        Id: uniqueId,
        Email: email,
        FileName: fileName,
        Timestamp: new Date().toISOString(),
        Status: status,
      },
    };
   
    try {
      console.log("Attempting to log email event to DynamoDB", params);
      await dynamoDb.put(params).promise();
      console.log("Successfully logged email event");
    } catch (error) {
      console.error("Error logging email event to DynamoDB:", error);
      throw error;
    }
  }