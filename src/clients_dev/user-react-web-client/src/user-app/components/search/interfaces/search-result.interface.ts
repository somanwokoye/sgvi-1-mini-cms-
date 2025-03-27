export default interface UserSearchResult { //as in server side UserSearchBody
    id: number,
    firstName: string,
    lastName: string,
    homeAddress: string,
    landlord?: boolean
}