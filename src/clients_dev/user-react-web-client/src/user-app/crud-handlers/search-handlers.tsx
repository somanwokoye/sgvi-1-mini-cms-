export class SearchHandlers {

    public static fetchSuggestions = async (value: string) => {

        const response = await fetch(`/v1/users/suggest?search-string=${value}`);
        if (!response.ok) throw new Error(response.statusText);
        const result = await response.json();
        return result;
    }

    public static getUser = async (userId: number) => {

        const response = await fetch(`/v1/users/${userId}`);
        if (!response.ok) throw new Error(response.statusText);
        return await response.json();

    };

    public static searchUsers = async (searchString: string) => {
        const response = await fetch(`/v1/users/search?search-string=${searchString}`);
        if (!response.ok) throw new Error(response.statusText);
        return await response.json();

    };
}