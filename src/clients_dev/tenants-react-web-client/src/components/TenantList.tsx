import React from 'react';
import { ITenant } from '../global/app.interfaces';
import Tenant from './Tenant';
import TenantListHeader from './TenantListHeader';


//declare type for Props passed to this 
type Props = {
    tenants: ITenant[],
}

const TenantList: React.FC<Props> = ({tenants}) => {

    //prepare tenants for display in a table
    let tenantListRows:any = null;
    
    tenantListRows = tenants.map((tenant) => {
        return <Tenant tenant={tenant} key={tenant.id}/>
    })
    

    return (
        <table className="table is-striped is-narrow is-hoverable" >
            <caption><h3>Available tenants</h3></caption>
            <TenantListHeader />
            <tbody>
                {tenantListRows}
            </tbody>
        </table>
    );
}

export default TenantList;
