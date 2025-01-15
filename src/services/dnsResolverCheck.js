import dns from 'dns';

const dnsResolverCheck = async (domain) => {
    dns.setServers(['1.1.1.1','1.1.1.2']); // Cloudflare DNS 서버 사용
    try {
        const records = await new Promise((resolve, reject) => {
            dns.resolveTxt(`_acme-challenge.${domain}`, (err, records) => {
                if (err) {
                    reject(err); // 오류가 있으면 reject
                } else {
                    resolve(records); // 결과가 있으면 resolve
                }
            });
        });

        console.log('DNS 조회 결과:', records);
        return { result: '성공!', color: 'bg-success', records: records };

    } catch (err) {
        console.error('DNS 조회 중 오류 발생');
        return { result: '실패!', color: 'bg-danger', message: err };
    }
};

export { dnsResolverCheck };