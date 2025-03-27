export default interface UserSearchBody {
    id: number,
    firstName: string,
    lastName: string,
    homeAddress: string,
    landlord?: boolean
    suggestFullName?: {},
    suggestFirstName?:{},
    suggestLastName?:{},
    suggestFullNameWithWeights:{}[]
}