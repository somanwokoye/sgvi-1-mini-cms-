import { IAddTenantState } from "../components/AddTenant";
import { IAssignableRegionInfo } from "../global/app.interfaces";
import { API_VERSION_URL } from "../global/app.settings";

export class RelationsHandlers {
    /**
     * Get assignable regions
     * @param state 
     * @param setState 
     */
    public static getAssignableRegions = async (state: IAddTenantState, setState: React.Dispatch<React.SetStateAction<IAddTenantState>>) => {
        try {
            const response = await fetch(`${API_VERSION_URL}/regions/get-tenant-assignable-regions-info`,
                {
                    method: 'GET',//notice the method
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

            if (!response.ok) throw new Error(response.statusText);//confirm that response is OK

            const data = await response.json(); //the server returns an array of Roles along with count.

            //alert(JSON.stringify(data));

            //filter out regions that are fully booked
            let assignableRegionsInfo: IAssignableRegionInfo[] = [];
            data.map((assignableRegion: IAssignableRegionInfo) => {

                if (assignableRegion.tenantCount < assignableRegion.tenantCountCapacity)
                    assignableRegionsInfo.push(assignableRegion);

            })

            //alert(JSON.stringify(assignableRegionsInfo));

            setState({...state, assignableRegionsInfo});
        } catch (error) {
            //strange error
            console.log(error);

        }
    }

    public static checkIfChosenDomainNameExists = async (subDomainName: string, regionRootDomainName: string, state: IAddTenantState, setState: React.Dispatch<React.SetStateAction<IAddTenantState>>) => {
        try {
            const response = await fetch(`${API_VERSION_URL}/tenants/check-if-chosen-domain-name-exists/${subDomainName}/${regionRootDomainName}`,
                {
                    method: 'GET',//notice the method
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

            if (!response.ok) throw new Error(response.statusText);//confirm that response is OK

            const data = await response.json(); //the server returns an array of Roles along with count.
            
            setState({...state, chosenDomainNameExists: data, domainNameExistsChecked: true});
        } catch (error) {
            //strange error
            console.log(error);

        }
    }
}