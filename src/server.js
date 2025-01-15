import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path,{dirname} from 'path';
import {fileURLToPath} from 'url';
import {getZoneId, addTxtRecord, deleteTxtRecord, tokenInfo} from './services/cloudflareAPI.js';
import { createAccountKey,createAccount, reqCert, reqAuth } from './services/letEncryptAPI.js';
import {dnsResolverCheck} from './services/dnsResolverCheck.js';
dotenv.config();
const app = express();
const port = process.env.PORT;

app.use(express.json());
app.use(bodyParser.json());

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssDirectoryPath = path.join(__dirname, 'css');

app.use(express.static(cssDirectoryPath));

app.get('/', (req, res) => {
    //res.send('Hello World');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/cloudflare/getZoneId', (req, res) => {
    const domainName = req.query.domain;
    getZoneId(domainName).then(zoneId => {
        res.send({id : zoneId});
    });
});

app.get('/letsencrypt/createAccountKey', (req, res) => {
    createAccountKey().then(result => {
        res.send(result);
    });
});

app.get('/letsencrypt/createAccount', (req, res) => {
    createAccount().then((result) => {
        res.send(result);
    });
});

app.get('/letsencrypt/reqCert', async (req, res) => {
    const domain = req.query.domain;
    const txtRecord = await reqCert(domain);
    res.send(txtRecord);
});


app.post('/cloudflare/addTxtRecord', async (req, res) => {
    const {zone_id, domain, TXTcontents} = req.body;
    const result = await addTxtRecord({zone_id, domain, TXTcontents})
    res.send(result);
    
});

app.get('/dns/DnsResolverCheck', async (req, res) => {
    const domain = req.query.domain;
    const result = await dnsResolverCheck(domain);
    res.send(result);
});

app.post('/letsencrypt/reqAuth', async (req, res) => {
    const {domain, order, authorizations} = req.body;
    const result = await reqAuth({domain, order, authorizations});
    res.send(result);
});

app.post('/cloudflare/deleteTxtRecord', async (req, res) => {
    const {zone_id, dnsRecordIds} = req.body;
    const result = await deleteTxtRecord(zone_id, dnsRecordIds);
    res.send(result);
});

app.get('/cloudflare/getTokenInfo',async (req, res) => {
    const result = await tokenInfo();
    res.send(result);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});