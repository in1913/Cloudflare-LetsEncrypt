import acme from 'acme-client';
import dotenv from 'dotenv';
import fs from 'fs';
import path, {dirname} from 'path';
import {fileURLToPath} from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

acme.setLogger((message)=> {
    console.log(`Logger : ${message}`);
})
// accountKey 생성
const createAccountKey = async () => {
    try {
        // accountKey 생성
        const accountKey = await acme.forge.createPrivateKey();
    
        // 저장 경로 설정
        const accountKeyPath = path.resolve(__dirname, 'account.key');
    
        // 키를 파일로 저장
        fs.writeFileSync(accountKeyPath, accountKey, { encoding: 'utf8', flag: 'w' });
        //console.log(`accountKey가 저장되었습니다: ${accountKeyPath}`);
        return {result:'성공!', color: 'bg-success'};
    } catch (error) {
        console.error('accountKey 저장 중 오류 발생:', error);
        return {result:'실패!', color: 'bg-danger'};
    }
}

// accountKey 불러오기
const getAccountKeyFromPath = () => {
    const accountKeyPath = path.resolve(__dirname, 'account.key');
    // 키를 파일에서 불러오기
    if (fs.existsSync(accountKeyPath)) {
        const accountKey = fs.readFileSync(accountKeyPath, { encoding: 'utf8' });
        //console.log('accountKey를 성공적으로 불러왔습니다:', accountKey);

        return accountKey;
        
    } else {
        console.error('accountKey 파일이 존재하지 않습니다. 새로 생성하세요.');
        return null;
    }
};

const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt.staging,
    accountKey: getAccountKeyFromPath(),
    accountUrl: process.env.ACCOUNT_URL,
    backoffAttempts: 10,
    backoffMin: 10000,
    backoffMax: 10000
});



// 계정 생성
const createAccount = async () =>  {
    try{
        const result = await client.createAccount({
            termsOfServiceAgreed: true,
            contact: [`mailto: ${process.env.EMAIL}`]
        });
        console.log('계정이 성공적으로 생성되었습니다:', result);

        try{
            const accountUrl = client.getAccountUrl();
            console.log(`accountUrl : ${accountUrl}`);
        
        }catch(error){
            console.error('계정 URL을 가져오는 중 오류 발생:', error);
        }
        return {result:'성공!', color: 'bg-success'};
    }catch(error){
        console.error('계정 생성 중 오류 발생:', error);
        return {result:'실패!', color: 'bg-danger', message: error};
    }

    
}


// 인증서 요청 및 txt Record 반환
const reqCert = async (domain) => {
    const orderPayload =    {
        identifiers: [
            { type: 'dns', value: domain },
            { type: 'dns', value: `*.${domain}` },
        ],
    }

    try{
        const order = await client.createOrder(orderPayload);
        console.log('reqCert order: ', order);
        const authorizations = await client.getAuthorizations(order);
        console.log('reqCert authorizations: ', authorizations);
        for(const auth of authorizations){
            if(auth.status === 'valid'){
                const result = await client.deactivateAuthorization(auth);
                console.log('deactivateAuthorization:', result);
            }
        }
        
        
        const challenges = authorizations.map((auth) =>{
            return auth.challenges.find((c) => c.type === 'dns-01');
        });//.challenges.find((c) => c.type === 'dns-01');
        const contentList = [];
        challenges.forEach(async (challenge) => {
            const content = await client.getChallengeKeyAuthorization(challenge);
            contentList.push(content);
            console.log('content:', content);
        });
        
        return {
            result: '성공!', 
            color: 'bg-success', 
            order : order, 
            authorizations : authorizations,
            TXTcontents : contentList
        };
        
    

    }catch(error){
        console.error('reqCert 중 오류 발생:', error);
        return {result:'실패!', color: 'bg-danger', message: error};
    }
}



const reqAuth = async ({domain, order, authorizations}) => {
    console.log(`ACME 인증 요청!!!!`);
    
    for(const authorization of authorizations){
        const challenge = authorization.challenges.find((c) => c.type === 'dns-01');

        try{
            // ACME 서버에 도메인 소유권 검증을 요청
            await client.verifyChallenge(authorization, challenge);
            console.log('verifyChallenge:', challenge);
            
            // ACME 서버는 클라이언트가 제공한 챌린지 토큰을 검증하고, 도메인 소유권을 확인
            await client.completeChallenge(challenge);
            console.log('completeChallenge:', challenge);

            // ACME 서버에서 인증의 상태가 유효(valid)로 변경될 때까지 대기
            await client.waitForValidStatus(authorization);
            console.log('authorization waitForValidStatus:', authorization);

            // ACME 서버에서 챌린지의 상태가 유효(valid)로 변경될 때까지 대기
            await client.waitForValidStatus(challenge);
            console.log('challenge waitForValidStatus:', challenge);
            
            
        }catch(error){
            console.error('모든 챌린지 상태 유효(valid)로 업데이트 중 오류 발생:', error);
            return {result:'실패!', color: 'bg-danger', message: error};
        }
    }

    try{
        // ACME 서버에서 주문의 상태가 유효(valid)로 변경될 때까지 대기
        await client.waitForValidStatus(order);
        console.log('order waitForValidStatus:', order);

        
        const privkeyPath = path.resolve(__dirname, 'privkey.pem');
        const csrPath = path.resolve(__dirname, 'request.csr');
        let privkey;
        let requestCsr;
        // 키를 파일에서 불러오기
        if (fs.existsSync(privkeyPath) && fs.existsSync(csrPath)) {
            privkey = fs.readFileSync(privkeyPath, { encoding: 'utf8' });
            requestCsr = fs.readFileSync(csrPath, { encoding: 'utf8' });
    
        } else {
            [privkey,requestCsr] = await acme.forge.createCsr({
                commonName: domain,
                altNames: [`*.${domain}`,`${domain}`],
            });

            console.log('privkey:', privkey);

            // 개인키 파일 생성
            fs.writeFileSync(path.resolve(__dirname, 'privkey.pem'), privkey, { encoding: 'utf8', flag: 'w' });
            // CSR 파일 생성
            fs.writeFileSync(path.resolve(__dirname, 'request.csr'), requestCsr, { encoding: 'utf8', flag: 'w' });

        }
        
        

        
        // ACME 서버에 주문의 인증서를 생성해달라고 요청하는 메서드
        const finalizeOrder = await client.finalizeOrder(order, requestCsr);
        console.log('finalizeOrder:', finalizeOrder);

        const orderValidInterval = 
        setInterval(async () => {
            const updatedOrder = await client.getOrder(order);
            console.log('updatedOrder:status', updatedOrder.status);
            if(updatedOrder.status === 'valid'){
                
                clearInterval(orderValidInterval);

                let cert;
                while (!cert) {
                    try {
                        cert = await client.getCertificate(order);
                    } catch (error) {
                        if (error.message.includes('URL not found')) {
                            console.log('인증서 URL을 찾을 수 없습니다. 다시 시도합니다...');
                            await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
                        } else {
                            throw error;
                        }
                    }
                }
                console.log('cert:', cert);
                
                const certPemArr = acme.forge.splitPemChain(cert);
                console.log('certPemArr 길이 : ', certPemArr.length);
                // 도메인 인증서
                const certPem = certPemArr[0];
                console.log('certPem:', certPem);
                // 중간 인증서
                const chainPem = certPemArr[1];
                console.log('chainPem:', chainPem);
                // 전체 인증서
                const fullchainPem = certPem + chainPem;
                console.log('fullchainPem:', fullchainPem);
                // 기타 인증서
                //const otherPem = certPemArr[2];

                const certPemPath = path.resolve(__dirname, 'cert.pem');
                const chainPemPath = path.resolve(__dirname, 'chain.pem');
                const fullchainPemPath = path.resolve(__dirname, 'fullchain.pem');
                //const otherPemPath = path.resolve(__dirname, 'other.pem');

                const paths = [
                    {path : certPemPath, pem: certPem, name: 'cert.pem'}, 
                    {path : chainPemPath, pem: chainPem, name: 'chain.pem'}, 
                    {path: fullchainPemPath, pem:fullchainPem, name: 'fullchain.pem'}
                    //{'other.pem':[{path:otherPemPath, pem: otherPem, name: 'other.pem'}]}
                            ];
                for(const p of paths){
                    console.log('keyname: ', p.name);
                    if(!fs.existsSync(p.path)){
                        fs.writeFileSync(path.resolve(__dirname, p.path), p.pem, { encoding: 'utf8', flag: 'w' });
                    }
                }

                return {result:'성공!', color: 'bg-success'};
            }
        }, 5000);
        
    }catch(error){
        console.error('인증서 요청 중 오류 발생:', error);
        return {result:'실패!', color: 'bg-danger', message: error};
    }

};



export {createAccountKey,createAccount, reqCert, reqAuth};