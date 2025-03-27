//Here I use react-select. See https://react-select.com/async

import React, { useState } from 'react';
import { IUser } from '../../app.interfaces';
import AsyncSelect from 'react-select/async';
import { SearchHandlers } from '../../crud-handlers/search-handlers';

import {
    useHistory, //see https://ultimatecourses.com/blog/programmatically-navigate-react-router
    useRouteMatch //see https://reactrouter.com/web/example/nesting
} from 'react-router-dom';
import SearchResultList from './SearchResultList';

type SuggestionType = { //same as setup in server
    score: number,
    id: number,
    firstName: string,
    lastName: string,
    homeAddress: string,
    landlord: boolean
}

type StateType = {
    suggestions: SuggestionType[],
    user?: IUser | null//for use whenever a user is selected.
    showUser?: boolean
    searchResults?: [] | null
    showSearchResults?: boolean
    searchMode?: boolean //search mode vs suggest mode. Only show options when in search mode. Enter search mode on KeyDown is enter
}


const SearchUsers: React.FC = () => {

    const initialState = {
        suggestions: [],
        user: null,
        showUser: false,
        searchResults: null,
        showSearchResults: false,
        searchMode: false //search mode vs suggest mode. Only show options when in search mode. Enter search mode on KeyDown is enter

    }

    const [state, setState] = useState<StateType>(initialState);

    /**
     * This is the async function that is asynchronously called by AsyncSelect to get suggestions
     * @param inputValue 
     * @returns 
     */
    const loadOptions = async (inputValue: string) => {
        const suggestions = await SearchHandlers.fetchSuggestions(inputValue);
        //alert (JSON.stringify(suggestions))
        const options: { value: number; label: string; }[] = [];
        suggestions.map((suggestion: SuggestionType) => {
            options.push({ value: suggestion.id, label: `${suggestion.firstName} ${suggestion.lastName}` })
        });
        return options;
    }

    /**
     * This is called when user makes a selection. Use this to fetch the data selected immediately.
     * @param option 
     */
    const onChange = async (option: any) => {
        if (option) {
            try {
                //alert(JSON.stringify(option.value))
                const user: IUser = await SearchHandlers.getUser(option.value);

                //if (user) alert(JSON.stringify(user))
                //Get ready to show User
                setState({ ...state, showUser: true, user, searchMode: false })
            } catch (error) {
                //alert(error)
                console.log(error)
            }
        }
    }

    /**
     * This is called when the user presses any key on the keyboard.
     * Test to see if the key is the enter key.
     * Get the current value and call backend search and return SERP
     * @param event 
     */
    const onKeyDown = async (event: any) => {
        if (event.keyCode === 13) {
            event.preventDefault();
            //alert(`you have pressed enter key. The current entry is ${event.target.value}`);
            //At this point, call a general search
            try {
                const searchResults = await SearchHandlers.searchUsers(event.target.value);
                //alert(JSON.stringify(searchResults));
                //Get ready to show SERP
                setState({ ...state, searchResults, showSearchResults: true, searchMode: true })
            } catch (error) {
                console.log(error)
            }
            
        }else{
            setState({ ...state, searchMode: false })
        }

    }

    const customStyles = { //can be created inline for each of the components of react-search. See https://react-select.com/styles#style-object. May be better to use class already defined in CSS for the whole page/site; see https://react-select.com/styles#using-classnames 
        option: (provided: any, state_: { isSelected: boolean; }) => ({
            ...provided,
            borderBottom: '1px dotted pink',
            color: state_.isSelected ? 'yellow' : 'blue',
            padding: 20,
            width: '100%',
            display: state.searchMode? 'none' : 'flex'
        }),
        noOptionsMessage: () => ({
            display: state.searchMode? 'none' : 'flex',
            justifyContent: 'center',
            color: 'red'
        }),
        control: () => ({
            // none of react-select's styles are passed to <Control />
            width: '100%',
            color: 'white',
            backgroundColor: '#eee',
            display: 'flex'
        }),
        singleValue: (provided: any, state: { isDisabled: boolean; }) => {
            const opacity = state.isDisabled ? 0.5 : 1;
            const transition = 'opacity 300ms';

            return { ...provided, opacity, transition };
        }
    }

    /* Here we are setting up route for navigating to view result */
    // The `path` lets us build <Route> paths that are
    // relative to the parent route, while the `url` lets
    // us build relative links.
    // See https://reactrouter.com/web/example/nesting
    let { path, url } = useRouteMatch();

    const history = useHistory(); //To dynamically go to a route. See https://ultimatecourses.com/blog/programmatically-navigate-react-router

    const handleViewSearchResult = (user: IUser) => {//to be passed on to the SearchResult component via SearchResultList. I should have used context though.
        setState({ ...state, showUser: true, user, searchMode: false });
    }

    return (

        <div className="container">
            <div className="box">
                <div className="columns is-mobile">
                    <div className="column is-full">
                        <AsyncSelect
                            loadOptions={loadOptions}
                            onChange={onChange}
                            isClearable
                            isSearchable
                            cacheOptions
                            name="search"
                            styles={customStyles}
                            controlShouldRenderValue={true}
                            /*Theme is another way of managing styles, see https://react-select.com/styles#overriding-the-theme
                            theme={theme => ({
                                ...theme,
                                borderRadius: 0,
                                colors: {
                                  ...theme.colors,
                                  primary25: 'lightblue', //cursor/mouse over
                                  primary: 'blue', //selected
                                  neutral0: '#eee', //background of input box
                                },
                              })}
                              */

                            /* In place of the above style approaches, below can be used to apply style from the CSS available to the whole page. This should work better with general site theme. See https://react-select.com/styles#using-classnames
                            className='react-select-container'
                            classNamePrefix="react-select"
                            */
                            placeholder="Search users beginning with firstname for autosuggest"
                            onKeyDown={onKeyDown}
                        />
                    </div>
                </div>
                <div className="columns is-mobile">
                    <div className="column is-full">
                        {
                            state.user && state.showUser && history.push(`${path}/view-selected`, JSON.stringify({ ...state.user, returnUrl: path }))
                        }
                        {
                            state.searchResults && state.showSearchResults && <SearchResultList searchResults={state.searchResults} handleViewSearchResult={handleViewSearchResult} />
                        }
                    </div>

                </div>
            </div>
        </div>
    )
}

export default SearchUsers;
