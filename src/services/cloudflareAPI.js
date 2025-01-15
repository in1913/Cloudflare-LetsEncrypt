import Cloudflare from 'cloudflare';
import dotenv from 'dotenv';

dotenv.config();

const cf = new Cloudflare({
    token: process.env.CLOUDFLARE_API_TOKEN
    //apiEmail: process.env.EMAIL,
    //apiKey: process.env.CLOUDFLARE_API_KEY
});

// token info
const tokenInfo = async () => {
    try{
        const idInfo = await cf.user.tokens.list();
        console.log(idInfo);
        console.log(idInfo.result[0].policies[0]);
        const id = idInfo.result[0].id;

        const info = await cf.user.tokens.get(id);
        console.log(info);

        return {result:'성공!', color: 'bg-success'};
    }catch(error){
        console.log(error);
        return {result:'실패!', color: 'bg-danger'};
    }
};


// Cloudflare Zone ID
const getZoneId = async (domainName) => {
    
    const zones = await cf.zones.list();
    const zone = zones.result.find(zone => zone.name === domainName);

    if(zone){
        return zone.id; 
    }else{
        return null;
    }    
}

// DNS TXT Record ID add
const addTxtRecord = async ({zone_id, domain, TXTcontents}) => {

    try{
        let recordIds = [];
        for(const txtValue of TXTcontents){
            const params = {
                zone_id : zone_id,
                type: 'TXT',
                name: `_acme-challenge.${domain}`,
                content: `"${txtValue}"`,
                ttl: 60
            };

            const {...body } = params;
            
            const result = await cf.dns.records.create(params);
            recordIds.push(result.id);
        }

        return {result:'성공!', color: 'bg-success', recordIds: recordIds};
    }catch(error){
        console.log(error);
        return {result:'실패!', color: 'bg-danger', recordId: error};
    }
    
    
    
    
}

// DNS TXT Record ID delete
const deleteTxtRecord = async (zone_id, dnsRecordIds) => {
    try{
        const params = {
            zone_id: zone_id
        }
    
        const {...body} = params;

        for(const dnsRecordId of dnsRecordIds){            
            await cf.dns.records.delete(dnsRecordId, params);
        }
        console.log('deleteTxtRecord!');
        return {result:'성공!', color: 'bg-success'};
    }catch(error){
        console.log(error);
        return {result:'실패!', color: 'bg-danger'};
    }
}

// DNS TXT Record ID select
const selectTxtRecord = async (zoneId, domainName) => {
    const records = await cf.dnsRecords.browse(zoneId);
    const record = records.result.find(record => record.name === domainName);

    if(record){
        return record.id;
    }else{
        return null;
    }
}

export {getZoneId, addTxtRecord, deleteTxtRecord, tokenInfo};