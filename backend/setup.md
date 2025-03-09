

npm install express helmet cors express-session sequelize mysql2 fido2-lib dotenv


don't forget to add update env 


npx sequelize-cli model:generate --name User --attributes username:string,displayName:string
npx sequelize-cli model:generate --name Credential --attributes credentialId:string,publicKey:text,counter:integer,userId:integer