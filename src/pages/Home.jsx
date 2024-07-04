import React from 'react';
import { FaArrowRight } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div>
    {/* Section 1 */}
    <div className='relative mx-auto flex flex-col w-11/12 items-center text-white justify-between'>
        <Link to={"/signup"}>
          <div>
            <div>
                <p> Become an Instructor</p>
                <FaArrowRight/>
            </div>
          </div>

        </Link>
    </div>

    {/* Section 2 */}

    {/* Section 3 */}

    {/* Footer */}
    
    </div>
  )
}

export default Home